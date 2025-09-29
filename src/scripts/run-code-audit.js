

// scripts/run-code-audit.js
const path = require('path');

/**
 * This script uses Genkit to perform an AI-powered audit of a specific file.
 * 
 * Usage: node scripts/run-code-audit.js <path/to/file>
 */

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Error: Please provide a file path as an argument.");
    console.log("Usage: node scripts/run-code-audit.js <path/to/your/file.ts>");
    process.exit(1);
  }

  try {
    // Dynamically import the ES module in a CommonJS file.
    const { codeAuditFlow } = await import(path.resolve(__dirname, '../src/ai/code-audit-flow.ts'));
    
    // Run the Genkit flow with the provided file path.
    const auditResult = await codeAuditFlow.run({ filePath });

    console.log('\n--- 🤖 AI Code Audit Report ---');
    console.log(`File: ${filePath}`);
    console.log('------------------------------------');
    console.log(auditResult);
    console.log('------------------------------------\n');

  } catch (error) {
    console.error(`Failed to run code audit for ${filePath}:`, error);
    process.exit(1);
  }
}

main();
