/**
 * The Kinetix Language Compiler Front-End
 * Phase 1: Lexical Analysis & Abstract Syntax Tree (AST) Generation
 */

// Our test program written in our custom DSL
const sourceCode = `
system Gravity {
    accel: 0.1
}

particle Ball {
    y: 0.0
    vy: 0.0
}
`;

/**
 * 1. THE LEXER
 * Chops the raw text into categorized tokens, ignoring whitespace.
 */
function lex(input) {
    console.log("[Lexer] Scanning source code...");
    const tokens = [];
    let cursor = 0;

    while (cursor < input.length) {
        let char = input[cursor];

        // Skip whitespace
        if (/\s/.test(char)) {
            cursor++;
            continue;
        }

        // Match Symbols (Braces, Colons)
        if (/[{}:]/.test(char)) {
            tokens.push({ type: 'SYMBOL', value: char });
            cursor++;
            continue;
        }

        // Match Numbers (e.g., 0.1, 5, -3.2)
        if (/[0-9.-]/.test(char)) {
            let numStr = '';
            while (cursor < input.length && /[0-9.-]/.test(input[cursor])) {
                numStr += input[cursor];
                cursor++;
            }
            tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
            continue;
        }

        // Match Identifiers/Keywords (e.g., system, particle, Gravity, accel)
        if (/[a-zA-Z_]/.test(char)) {
            let word = '';
            while (cursor < input.length && /[a-zA-Z_]/.test(input[cursor])) {
                word += input[cursor];
                cursor++;
            }
            // Tag reserved keywords specially
            if (word === 'system' || word === 'particle') {
                tokens.push({ type: 'KEYWORD', value: word });
            } else {
                tokens.push({ type: 'IDENTIFIER', value: word });
            }
            continue;
        }

        throw new Error(`Lexer Error: Unrecognized character '${char}' at index ${cursor}`);
    }
    return tokens;
}

/**
 * 2. THE PARSER
 * Reads the linear list of tokens and builds a hierarchical AST (Abstract Syntax Tree).
 */
function parse(tokens) {
    console.log("[Parser] Building Abstract Syntax Tree...");
    let current = 0;
    
    // The root of our compiled tree
    const ast = {
        type: 'Program',
        body: []
    };

    while (current < tokens.length) {
        let token = tokens[current];

        // Parse a "system" block (Global constants)
        if (token.type === 'KEYWORD' && token.value === 'system') {
            const node = { type: 'SystemDeclaration', name: tokens[++current].value, properties: {} };
            
            current++; // Skip the '{'
            while (tokens[++current].value !== '}') {
                if (tokens[current].type === 'IDENTIFIER') {
                    let propName = tokens[current].value;
                    current++; // Skip ':'
                    let propValue = tokens[++current].value; // The number
                    node.properties[propName] = propValue;
                }
            }
            current++; // Skip the '}'
            ast.body.push(node);
            continue;
        }

        // Parse a "particle" block (Memory-bound objects)
        if (token.type === 'KEYWORD' && token.value === 'particle') {
            const node = { type: 'ParticleDeclaration', name: tokens[++current].value, properties: {} };
            
            current++; // Skip the '{'
            while (tokens[++current].value !== '}') {
                if (tokens[current].type === 'IDENTIFIER') {
                    let propName = tokens[current].value;
                    current++; // Skip ':'
                    let propValue = tokens[++current].value; // The number
                    node.properties[propName] = propValue;
                }
            }
            current++; // Skip the '}'
            ast.body.push(node);
            continue;
        }

        throw new Error(`Parser Error: Unexpected token ${token.value}`);
    }

    return ast;
}

// --- EXECUTE THE COMPILER FRONT-END ---
const tokens = lex(sourceCode);
console.log(`[Lexer] Extracted ${tokens.length} tokens.`);

const ast = parse(tokens);
console.log("\n[Parser] Final Abstract Syntax Tree:");
// Print the AST nicely formatted
console.log(JSON.stringify(ast, null, 2));
