
'use server';

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const path = require('path');

// A predefined list of critical or complex files to check when no specific file is provided.
const PREDEFINED_FILES_TO_AUDIT = [
    'src/dashboard-client-page.tsx',
    'src/app/admin/flights/flights-client.tsx',
    'src/services/user-profile-service.ts',
    'src/app/requests/page.tsx',
];

/**
 * Runs the audit flow on a single file and logs the result.
 * @param {string} filePath - The relative path to the file to audit.
 */
async function runAudit(filePath) {
    try {
        console.log(`\n--- 🤖 AI Code Audit for: ${filePath} ---\n`);
        // Dynamically import the ES module as the flow is an ES module
        const { codeAuditFlow } = await import('../ai/code-audit-flow.ts');
        const auditResult = await codeAuditFlow({ filePath });
        console.log(auditResult);
        console.log('\n------------------------------------\n');
    } catch (error) {
        console.error(`Failed to run code audit for ${filePath}:`, error);
    }
}

/**
 * Main function to run the audit.
 * Audits a specific file if provided as an argument, otherwise runs on a predefined list.
 */
async function main() {
  const specificFile = process.argv[2];

  if (specificFile) {
    console.log(`🚀 Running single-file audit for: ${specificFile}`);
    await runAudit(specificFile);
  } else {
    console.log(`🚀 Running predefined audit on ${PREDEFINED_FILES_TO_AUDIT.length} critical files...`);
    for (const filePath of PREDEFINED_FILES_TO_AUDIT) {
        await runAudit(filePath);
    }
    console.log("✅ Predefined audit complete.");
  }
}

main();
