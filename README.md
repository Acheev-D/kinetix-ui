# Kinetix UI ⚡

A high-performance, ultra-lightweight physics interaction engine compiled directly to raw WebAssembly.

**A zero-dependency, battery-safe WebAssembly spring physics engine for the modern web.**

Modern web animation is broken. We rely on massive 40KB+ JavaScript libraries (like Framer Motion or React Spring) to calculate UI physics on the browser's main thread. This drains mobile batteries, drops frames, and bloats bundle sizes.

**Kinetix** is different. It is a custom compiler that generates a raw, bare-metal hardware physics engine. By bypassing the heavy JavaScript main thread math entirely, Kinetix calculates kinetic spring states natively on the CPU's Floating-Point Unit (FPU). 

The result? A complete spring physics engine in **under 200 bytes**.

## The Benchmark

| Engine / Library | Size (Gzipped) | Execution Layer | Memory Footprint |
| :--- | :--- | :--- | :--- |
| **Framer Motion** | ~45,000 bytes | JS Main Thread | Dynamic Heap |
| **React Spring** | ~30,000 bytes | JS Main Thread | Dynamic Heap |
| **Kinetix UI** | **95 bytes** | **Native WASM FPU** | **Static Linear Memory** |

## ✨ Features

* **Bare-Metal Performance:** Bypasses heavy JavaScript math entirely. Physics are calculated natively in WebAssembly hardware loops.
* **4D Memory Stride:** Animates X, Y, Scale, and Rotation simultaneously in a single contiguous 48-byte memory block.
* **Battery-Safe (Sleep Threshold):** Automatically detects when kinetic energy drops below visual thresholds and snaps the CPU to sleep mode to prevent mobile battery drain.
* **Zero Dependencies:** No NPM installs. No bundlers required. Just drop it in.

## 🚀 Quick Start

1. Drop `kinetix.wasm` and `index.html` into your project folder.
2. Open `index.html` to see the engine boot and attach to the DOM.

```html
<script type="module">
    // The engine boots natively from the local WASM binary
    const engine = await Kinetix.boot('kinetix.wasm');
    
    const card = document.getElementById('myCard');
    const cardNode = engine.register(card);
    
    // Animations execute directly via shared memory
    engine.animate(cardNode, { y: -20, scale: 1.05, rotate: 2 });
</script>

## 🧠 Architecture Details

Kinetix is not a standard JavaScript library. It was built from scratch using a custom Domain Specific Language (DSL).

* **The Lexer/Parser:** Translates human-readable physics constraints into an Abstract Syntax Tree (AST).
* **The Compiler:** Injects the AST into raw WebAssembly hex opcodes, generating hardware loops (`0x03`) and stack-aligned floating-point math (`f32.add`, `f32.mul`).
* **The API Bridge:** JavaScript simply writes target values directly into the CPU's linear `Float32Array` shared memory, allowing the WebAssembly loop to process thousands of properties in a fraction of a millisecond.

## 📄 License

MIT. Built from the bare metal up.
