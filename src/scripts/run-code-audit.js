
'use server';

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const path = require('path');

/**
 * This script uses Genkit to perform an AI-powered audit of a specific file.
 *
 * Usage: tsx src/scripts/run-code-audit.js <path/to/file>
 */
async function main() {
  const relativeFilePath = process.argv[2];

  if (!relativeFilePath) {
    console.error("Error: Please provide a file path as an argument.");
    console.log("Usage: tsx src/scripts/run-code-audit.js <path/to/your/file.ts>");
    process.exit(1);
  }

  try {
    // Dynamically import the ES module in a CommonJS-like environment powered by tsx
    const { codeAuditFlow } = await import('../ai/code-audit-flow.ts');

    const auditResult = await codeAuditFlow({ filePath: relativeFilePath });

    console.log(`\n--- 🤖 AI Code Audit Report for: ${relativeFilePath} ---\n`);
    console.log(auditResult);
    console.log('\n------------------------------------\n');
  } catch (error) {
    console.error(`Failed to run code audit for ${relativeFilePath}:`, error);
    process.exit(1);
  }
}

main();
