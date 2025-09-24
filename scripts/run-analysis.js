// scripts/run-analysis.js
const path = require('path');

// This script simulates a cron job that would run nightly.
// It imports the server-side analysis function and executes it.

// We need to use dynamic import for an ES module ('use server') in a CommonJS file.
async function main() {
  try {
    const { generateOptimizedAlertRules } = await import(path.resolve(__dirname, '../src/services/predictive-analyzer.ts'));
    
    const improvements = await generateOptimizedAlertRules();

    if (improvements.length > 0) {
      console.log('\n--- 🤖 Auto-Optimization Complete ---');
      console.log(`A total of ${improvements.length} optimization(s) were suggested.`);
      console.log('A report has been generated at ./suggested-optimizations.json.');
      console.log('Next step: Review the report and use it to generate a Pull Request for `src/lib/alert-rules.ts`.');
    } else {
      console.log('\n✅ All alert rules are performing within optimal parameters. No changes suggested.');
    }

  } catch (error) {
    console.error("Failed to run predictive analysis:", error);
    process.exit(1);
  }
}

main();
