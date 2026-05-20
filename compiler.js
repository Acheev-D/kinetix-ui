const fs = require('fs');

/**
 * Helper function to convert a JavaScript float into a 4-byte IEEE 754 array.
 * This is required to translate decimal numbers into raw CPU hardware bytes.
 */
function floatToBytes(val) {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatLE(val); // Write as Little-Endian float
    return Array.from(buffer);
}

/**
 * Compiles a WebAssembly module containing shared linear memory
 * and an explicit state mutation loop function.
 */
function compileStatefulEngine() {
    console.log(`[Compiler] Generating Stateful Physics Engine Architecture...`);
    
    // --- STEP FUNCTION BYTECODE GENERATION ---
    const bytecode = [0x00]; // 0 local variables
    
    // 1. Calculate vel_y: vel_y = vel_y + 0.1 (Gravity)
    bytecode.push(0x41, 0x00);       // i32.const 0 (target memory address for store)
    bytecode.push(0x41, 0x00);       // i32.const 0 (source memory address for load)
    bytecode.push(0x2a, 0x02, 0x0c); // f32.load (align=2, offset=12 -> vel_y)
    bytecode.push(0x43, ...floatToBytes(0.1)); // f32.const 0.1 (Gravity constant)
    bytecode.push(0x92);             // f32.add
    bytecode.push(0x38, 0x02, 0x0c); // f32.store (align=2, offset=12 -> vel_y)
    
    // 2. Calculate pos_y: pos_y = pos_y + vel_y
    bytecode.push(0x41, 0x00);       // i32.const 0 (target memory address for store)
    bytecode.push(0x41, 0x00);       // i32.const 0 (source memory address for load pos_y)
    bytecode.push(0x2a, 0x02, 0x04); // f32.load (align=2, offset=4 -> pos_y)
    bytecode.push(0x41, 0x00);       // i32.const 0 (source memory address for load vel_y)
    bytecode.push(0x2a, 0x02, 0x0c); // f32.load (align=2, offset=12 -> vel_y)
    bytecode.push(0x92);             // f32.add
    bytecode.push(0x38, 0x02, 0x04); // f32.store (align=2, offset=4 -> pos_y)
    
    bytecode.push(0x0b);             // end of function

    // --- STRUCTURING THE SECTIONS ---
    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];
    
    // Type Section: 1 type, func signature, 0 params, 0 returns (void function)
    const typeSection = [0x01, 0x04, 0x01, 0x60, 0x00, 0x00];
    const funcSection = [0x03, 0x02, 0x01, 0x00];
    
    // Memory Section: Declare 1 block of linear memory (1 page = 64KB)
    const memorySection = [0x05, 0x03, 0x01, 0x00, 0x01];
    
    // Export Section: Export both "memory" and our "step" routine
    const exportSection = [
        0x07, 0x11, 0x02,
        0x06, ...Buffer.from("memory"), 0x02, 0x00, // Export Memory index 0
        0x04, ...Buffer.from("step"),   0x00, 0x00  // Export Function index 0
    ];
    
    const codeSectionPayload = [0x01, bytecode.length, ...bytecode];
    const codeSection = [0x0a, codeSectionPayload.length, ...codeSectionPayload];
    
    // Combine everything into one single continuous binary stream
    return Buffer.from([
        ...magic, 
        ...version, 
        ...typeSection, 
        ...funcSection, 
        ...memorySection, 
        ...exportSection, 
        ...codeSection
    ]);
}

// Execute Compilation
const compiledBinary = compileStatefulEngine();
fs.writeFileSync('engine.wasm', compiledBinary);
console.log(`[System] 'engine.wasm' generated. Size: ${compiledBinary.length} bytes.`);

// --- RUNTIME INTERFACE TESTING ---
WebAssembly.instantiate(compiledBinary).then(output => {
    const { step, memory } = output.instance.exports;
    
    // Create a view into the WASM raw memory buffer using Floats (each index = 4 bytes)
    const memoryView = new Float32Array(memory.buffer);
    
    // Set initial condition: Object is stationary at Y position 0.0
    memoryView[1] = 0.0;  // Offset 4 bytes (Index 1 of Float32Array) -> pos_y
    memoryView[3] = 0.0;  // Offset 12 bytes (Index 3 of Float32Array) -> vel_y
    
    console.log("\n--- Starting 5-Frame Physics Step Integration ---");
    for (let frame = 1; frame <= 5; frame++) {
        step(); // Run physics step inside CPU hardware registers
        
        console.log(`[Frame ${frame}] Position Y: ${memoryView[1].toFixed(3)}m | Velocity Y: ${memoryView[3].toFixed(3)}m/s`);
    }
}).catch(err => {
    console.error("[Runtime Error]:", err);
});