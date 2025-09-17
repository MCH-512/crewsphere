// src/scripts/run-code-audit.js
const path = require('path');
const fs = require('fs/promises');

// This is a bridge script to run the watchdog's analyzer in proactive mode.
// We are dynamically importing to handle CommonJS vs ES Module differences.
// This approach is more complex than ideal, but necessary for this project structure.

async function main() {
    console.log('🚀 Starting Proactive AI Code Audit...');

    // Define the list of critical files to be audited
    const filesToAudit = [
        'src/services/user-service.ts',
        'src/services/flight-service.ts',
        'src/services/flight-swap-service.ts',
        'src/app/my-schedule/my-schedule-client.tsx',
    ];

    try {
        // Dynamically load the config and the analyzer
        const configPath = path.resolve(__dirname, '../../watchdog/config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
        
        // This is a trick to load the analyzer from its directory
        const Analyzer = require(path.resolve(__dirname, '../../watchdog/analyzer.js'));
        const analyzer = new Analyzer(config);

        const analysis = await analyzer.analyzeCodeForImprovements(filesToAudit);

        if (analysis && analysis.actionable && analysis.patch) {
            console.log('✅ AI analysis complete. Actionable refactoring suggested.');
            
            const Repairer = require(path.resolve(__dirname, '../../watchdog/repairer_github.js'));
            const repairer = new Repairer(config);
            
            const pr = await repairer.createPRFromAnalysis(analysis, { signature: 'Proactive-Code-Audit' });
            if (pr) {
                console.log(`✅ Successfully created Pull Request: ${pr.html_url}`);
                // Set output for GitHub Actions
                console.log(`::set-output name=pr_url::${pr.html_url}`);
                console.log(`::set-output name=analysis_id::${analysis.analysisId}`);
            } else {
                console.error('❌ Failed to create Pull Request from analysis.');
                process.exit(1);
            }
        } else {
            console.log('✅ AI analysis complete. No actionable improvements suggested at this time.');
        }

    } catch (error) {
        console.error('❌ An error occurred during the AI code audit process:', error);
        process.exit(1);
    }
}

main();
