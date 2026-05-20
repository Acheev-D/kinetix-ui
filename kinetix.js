const fs = require('fs');

// ==========================================
// THE KINETIX SWARM DSL
// ==========================================
const sourceCode = `
system World {
    gravity_x: 0.0
    gravity_y: 0.15
}
`;

function lex(input) {
    const tokens = [];
    let cursor = 0;
    while (cursor < input.length) {
        let char = input[cursor];
        if (/\s/.test(char)) { cursor++; continue; }
        if (/[{}:]/.test(char)) { tokens.push({ type: 'SYMBOL', value: char }); cursor++; continue; }
        if (/[0-9.-]/.test(char)) {
            let numStr = '';
            while (cursor < input.length && /[0-9.-]/.test(input[cursor])) { numStr += input[cursor]; cursor++; }
            tokens.push({ type: 'NUMBER', value: parseFloat(numStr) }); continue;
        }
        if (/[a-zA-Z_]/.test(char)) {
            let word = '';
            while (cursor < input.length && /[a-zA-Z_]/.test(input[cursor])) { word += input[cursor]; cursor++; }
            if (word === 'system' || word === 'particle') tokens.push({ type: 'KEYWORD', value: word });
            else tokens.push({ type: 'IDENTIFIER', value: word });
            continue;
        }
        throw new Error(`Lexer Error: Unrecognized character '${char}'`);
    }
    return tokens;
}

function parse(tokens) {
    let current = 0;
    const ast = { type: 'Program', body: [] };
    while (current < tokens.length) {
        let token = tokens[current];
        if (token.type === 'KEYWORD' && token.value === 'system') {
            const node = { type: 'SystemDeclaration', name: tokens[++current].value, properties: {} };
            current++; 
            while (tokens[++current].value !== '}') {
                if (tokens[current].type === 'IDENTIFIER') {
                    let propName = tokens[current].value;
                    current++; 
                    node.properties[propName] = tokens[++current].value; 
                }
            }
            current++; 
            ast.body.push(node);
            continue;
        }
        current++;
    }
    return ast;
}

function floatToBytes(val) {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatLE(val);
    return Array.from(buffer);
}

function compileSwarmWASM(ast) {
    console.log("[Compiler] Generating Hardware Loop & Memory Stride...");
    
    let gx = 0.0, gy = 0.15;
    const system = ast.body.find(n => n.type === 'SystemDeclaration' && n.name === 'World');
    if (system) {
        gx = parseFloat(system.properties.gravity_x || 0);
        gy = parseFloat(system.properties.gravity_y || 0);
    }

    // --- RAW HARDWARE LOOP BYTECODE ---
    const bytecode = [
        0x01, 0x02, 0x7f, // Declare 2 local variables: $ptr (i32), $i (i32)

        0x02, 0x40, // block (Boundary to break out of)
        0x03, 0x40, // loop (Target to jump back to)

        // if ($i >= particleCount) break;
        0x20, 0x02, // local.get $i (Index 2)
        0x20, 0x00, // local.get $count (Index 0, passed from JS)
        0x4f,       // i32.ge_u (FIXED: 0x4f ensures the loop runs correctly!)
        0x0d, 0x01, // br_if 1 (Break block)

        // 1. UPDATE VX
        0x20, 0x01, 0x20, 0x01, 0x2a, 0x02, 0x08, 
        0x43, ...floatToBytes(gx), 0x92, 0x38, 0x02, 0x08,

        // 2. UPDATE VY
        0x20, 0x01, 0x20, 0x01, 0x2a, 0x02, 0x0c, 
        0x43, ...floatToBytes(gy), 0x92, 0x38, 0x02, 0x0c,

        // 3. UPDATE X (x = x + vx)
        0x20, 0x01, 0x20, 0x01, 0x2a, 0x02, 0x00, 
        0x20, 0x01, 0x2a, 0x02, 0x08, 0x92, 0x38, 0x02, 0x00,

        // 4. UPDATE Y (y = y + vy)
        0x20, 0x01, 0x20, 0x01, 0x2a, 0x02, 0x04, 
        0x20, 0x01, 0x2a, 0x02, 0x0c, 0x92, 0x38, 0x02, 0x04,

        // $i++
        0x20, 0x02, 0x41, 0x01, 0x6a, 0x21, 0x02,

        // $ptr += 16 (Move memory head 16 bytes forward to the next particle)
        0x20, 0x01, 0x41, 0x10, 0x6a, 0x21, 0x01,

        // Jump back to loop start
        0x0c, 0x00, 
        
        0x0b, // end loop
        0x0b, // end block
        0x0b  // end function
    ];

    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];
    
    // Type signature accepts 1 parameter (i32 count)
    const typeSection = [0x01, 0x05, 0x01, 0x60, 0x01, 0x7f, 0x00];
    const funcSection = [0x03, 0x02, 0x01, 0x00];
    
    // INCREASED MEMORY: Ask the OS for 10 pages of memory (640 KB = ~40,000 particles)
    const memorySection = [0x05, 0x03, 0x01, 0x00, 0x0a];
    
    const exportSection = [
        0x07, 0x11, 0x02,
        0x06, ...Buffer.from("memory"), 0x02, 0x00,
        0x04, ...Buffer.from("step"),   0x00, 0x00
    ];
    
    const codeSectionPayload = [0x01, bytecode.length, ...bytecode];
    const codeSection = [0x0a, codeSectionPayload.length, ...codeSectionPayload];
    
    return Buffer.from([...magic, ...version, ...typeSection, ...funcSection, ...memorySection, ...exportSection, ...codeSection]);
}

const ast = parse(lex(sourceCode));
const compiledBinary = compileSwarmWASM(ast);
fs.writeFileSync('kinetix.wasm', compiledBinary);
console.log(`[System] 'kinetix.wasm' Swarm Engine generated! Capacity: 40,000 entities.`);