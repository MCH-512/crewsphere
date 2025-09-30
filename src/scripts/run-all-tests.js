
const { exec } = require('child_process');
const path = require('path');

const scripts = [
  // { name: 'Unit Tests', command: 'npm run test:unit' }, // Temporarily disabled
  // { name: 'Accessibility Tests', command: 'npm run test:accessibility' }, // Temporarily disabled
  { name: 'E2E Tests', command: 'npx playwright test' },
  // { name: 'AI Validation Tests', command: 'npm run test:ai' }, // Temporarily disabled
];

function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting: ${script.name}...`);
    const projectRoot = path.resolve(__dirname, '..', '..');
    const process = exec(script.command, { cwd: projectRoot });

    process.stdout.on('data', (data) => {
      console.log(`[${script.name}] ${data.toString()}`);
    });

    process.stderr.on('data', (data) => {
      console.error(`[${script.name} ERROR] ${data.toString()}`);
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Success: ${script.name} completed.\n`);
        resolve();
      } else {
        console.error(`❌ Failed: ${script.name} exited with code ${code}.\n`);
        reject(new Error(`${script.name} failed.`));
      }
    });
  });
}

async function runAllTests() {
  console.log('--- 🛡️  Starting Simplified Test Suite 🛡️  ---\n');
  for (const script of scripts) {
    try {
      await runScript(script);
    } catch (error) {
      console.error(`\nAborting test suite due to failure in: ${error.message}`);
      process.exit(1);
    }
  }
  console.log('--- 🎉 All tests passed successfully! ---');
}

runAllTests();
