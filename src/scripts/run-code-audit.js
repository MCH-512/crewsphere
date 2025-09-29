// scripts/run-code-audit.js
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });


/**
 * This script uses Genkit to perform an AI-powered audit of a specific file.
 * 
 * Usage: node scripts/run-code-audit.js <path/to/file>
 */

async function runAudit(filePath) {
    try {
        console.log(`🤖 Starting code audit for: ${filePath}`);
        // Dynamically import the ES module in a CommonJS file.
        const { codeAuditFlow } = await import(path.resolve(process.cwd(), 'src/ai/code-audit-flow.ts'));
        
        // Run the Genkit flow with the provided file path.
        const auditResult = await codeAuditFlow({ filePath });

        console.log(`\n--- 🤖 AI Code Audit Report for: ${filePath} ---`);
        console.log('------------------------------------');
        console.log(auditResult);
        console.log('------------------------------------\n');

    } catch (error) {
        console.error(`Failed to run code audit for ${filePath}:`, error);
    }
}

async function main() {
  console.log("🚀 Running predefined audit on 4 critical files...");
  const filesToAudit = [
    'src/dashboard-client-page.tsx',
    'src/app/admin/flights/flights-client.tsx',
    'src/services/user-profile-service.ts',
    'src/app/requests/page.tsx'
  ];

  for (const file of filesToAudit) {
    await runAudit(file);
  }

  console.log("✅ Predefined audit complete.");
}

main();
    