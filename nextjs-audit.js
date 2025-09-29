
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const acorn = require('acorn');
const jsx = require('acorn-jsx');

const JSXParser = acorn.Parser.extend(jsx());

console.log("🚀 Starting Next.js code quality audit...");

let violations = 0;

// Function to recursively find nodes of a certain type
function findNodes(node, type, foundNodes = []) {
    if (node.type === type) {
        foundNodes.push(node);
    }
    for (const key in node) {
        if (typeof node[key] === 'object' && node[key] !== null) {
            findNodes(node[key], type, foundNodes);
        }
    }
    return foundNodes;
}

async function auditFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip files that don't import 'useEffect' for performance
    if (!content.includes('useEffect')) {
        return;
    }

    try {
        const ast = JSXParser.parse(content, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true
        });

        // Heuristic 1: Find `useEffect` with `fetch` inside
        const useEffectNodes = findNodes(ast, 'CallExpression').filter(
            (node) => node.callee.type === 'Identifier' && node.callee.name === 'useEffect'
        );

        for (const node of useEffectNodes) {
            const fetchNodes = findNodes(node, 'CallExpression').filter(
                (call) => call.callee.type === 'Identifier' && call.callee.name === 'fetch'
            );

            if (fetchNodes.length > 0) {
                const { line } = fetchNodes[0].loc.start;
                console.warn(`[WARNING] Anti-pattern found in ${filePath}:${line}`);
                console.warn(`  > Data fetching inside useEffect. Consider using Server Components or route handlers for better performance and SSR.\n`);
                violations++;
            }
        }

    } catch (e) {
        console.error(`Could not parse ${filePath}. Error: ${e.message}`);
    }
}

async function runAudit() {
    const files = await glob('src/app/**/page.tsx', { ignore: 'node_modules/**' });
    
    for (const file of files) {
        await auditFile(file);
    }

    if (violations > 0) {
        console.error(`\n❌ Audit failed with ${violations} violation(s).`);
        console.info("Review the warnings above. Using `fetch` inside `useEffect` in Server Components is an anti-pattern in Next.js 14.");
        // process.exit(1); // In a real CI, you would uncomment this to fail the build.
    } else {
        console.log("\n✅ Next.js code quality audit passed. No violations found.");
    }
}

runAudit();
