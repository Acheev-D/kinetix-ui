const fs = require('fs');

function floatToBytes(val) {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatLE(val);
    return Array.from(buffer);
}

function compileKinetixEngine() {
    console.log("[Compiler] Generating 4D UI Spring Engine...");
    
    let k = 0.15; // Stiffness
    let d = 0.12; // Damping

    const bytecode = [
        0x01, 0x02, 0x7f, // Declare 2 locals: $ptr (Index 1), $i (Index 2)

        0x02, 0x40, // block
        0x03, 0x40, // loop

        // if ($i >= property_count) break;
        0x20, 0x02, 
        0x20, 0x00, // Load param 0 ($count)
        0x4f,       // i32.ge_u
        0x0d, 0x01, // br_if break

        // --- HOOKE'S LAW ---
        // 1. New Velocity
        0x20, 0x01,                   // Push $ptr for the Store operation later
        
        0x20, 0x01, 0x2a, 0x02, 0x08, // Load Target (offset 8)
        0x20, 0x01, 0x2a, 0x02, 0x00, // Load Pos (offset 0)
        0x93,                         // f32.sub
        0x43, ...floatToBytes(k),     // Const K
        0x94,                         // f32.mul -> [Force]

        0x20, 0x01, 0x2a, 0x02, 0x04, // Load Vel (offset 4)
        0x43, ...floatToBytes(d),     // Const D
        0x94,                         // f32.mul -> [Drag]

        0x93,                         // f32.sub -> [Accel]
        
        0x20, 0x01, 0x2a, 0x02, 0x04, // Load Vel
        0x92,                         // f32.add
        0x38, 0x02, 0x04,             // Store new Vel at offset 4

        // 2. New Position
        0x20, 0x01,                   // Push $ptr
        0x20, 0x01, 0x2a, 0x02, 0x00, // Load Pos
        0x20, 0x01, 0x2a, 0x02, 0x04, // Load new Vel
        0x92,                         // f32.add
        0x38, 0x02, 0x00,             // Store new Pos at offset 0

        // --- ADVANCE LOOP ---
        0x20, 0x02, 0x41, 0x01, 0x6a, 0x21, 0x02, // $i++
        0x20, 0x01, 0x41, 0x0c, 0x6a, 0x21, 0x01, // $ptr += 12 bytes

        0x0c, 0x00, // jump to start of loop
        
        0x0b, // end loop
        0x0b, // end block
        0x0b  // end function
    ];

    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];
    
    // Type signature: 1 param (i32 count), 0 results
    const typeSection = [0x01, 0x05, 0x01, 0x60, 0x01, 0x7f, 0x00];
    const funcSection = [0x03, 0x02, 0x01, 0x00];
    const memorySection = [0x05, 0x03, 0x01, 0x00, 0x01];
    const exportSection = [
        0x07, 0x11, 0x02,
        0x06, ...Buffer.from("memory"), 0x02, 0x00,
        0x04, ...Buffer.from("step"),   0x00, 0x00
    ];
    
    const codeSectionPayload = [0x01, bytecode.length, ...bytecode];
    const codeSection = [0x0a, codeSectionPayload.length, ...codeSectionPayload];
    
    return Buffer.from([...magic, ...version, ...typeSection, ...funcSection, ...memorySection, ...exportSection, ...codeSection]);
}

fs.writeFileSync('kinetix.wasm', compileKinetixEngine());
console.log(`[System] 'kinetix.wasm' generated. (4D Capable)`);