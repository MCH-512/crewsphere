
// scripts/apply-optimizations.js
import { promises as fs } from 'fs';
import path from 'path';

const REPORT_PATH = path.join(process.cwd(), 'suggested-optimizations.json');
const RULES_PATH = path.join(process.cwd(), 'src', 'lib', 'alert-rules.ts');

async function applyOptimizations() {
  console.log('🚀 Applying AI-suggested optimizations to alert rules...');

  try {
    const reportContent = await fs.readFile(REPORT_PATH, 'utf8');
    const report = JSON.parse(reportContent);

    if (!report.optimizations || report.optimizations.length === 0) {
      console.log('✅ No optimizations to apply. Exiting.');
      return;
    }

    let rulesFileContent = await fs.readFile(RULES_PATH, 'utf8');

    let changesMade = false;
    for (const opt of report.optimizations) {
      const { key, newRule } = opt;
      
      // Use regex to find the rule block for the given key
      const ruleRegex = new RegExp(`(${key}:\\s*\\{[^\\}]*threshold:\\s*)\\d+`, 'm');

      if (ruleRegex.test(rulesFileContent)) {
        rulesFileContent = rulesFileContent.replace(ruleRegex, `$1${newRule.threshold}`);
        console.log(`- Updated threshold for [${key}] to ${newRule.threshold}.`);
        changesMade = true;
      } else {
        console.warn(`- Could not find rule block for [${key}] to update threshold.`);
      }
      
      // Regex for timeoutHours, handles optional property
      if (newRule.timeoutHours !== undefined) {
         const timeoutRegex = new RegExp(`(${key}:\\s*\\{[^\\}]*timeoutHours:\\s*)\\d+`, 'm');
         if (timeoutRegex.test(rulesFileContent)) {
             rulesFileContent = rulesFileContent.replace(timeoutRegex, `$1${newRule.timeoutHours}`);
             console.log(`- Updated timeoutHours for [${key}] to ${newRule.timeoutHours}.`);
             changesMade = true;
         } else {
             // If timeoutHours doesn't exist, we'd need a more complex AST parser to add it.
             // For this simulation, we'll just log that we can't add it.
             console.warn(`- Could not find timeoutHours for [${key}] to update. Manual addition may be needed.`);
         }
      }
    }

    if (changesMade) {
      await fs.writeFile(RULES_PATH, rulesFileContent, 'utf8');
      console.log('✅ Successfully applied optimizations to src/lib/alert-rules.ts.');
    } else {
        console.log('ℹ️ No applicable changes were made to the rules file.');
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️ No optimization report file found. Skipping application.');
    } else {
      console.error('❌ Failed to apply optimizations:', error);
      process.exit(1);
    }
  }
}

applyOptim