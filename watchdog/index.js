// index.js
const fs = require('fs');
const path = require('path');
const Collector = require('./collector_bigquery');
const Analyzer = require('./analyzer');
const Repairer =require('./repairer_github');
const FirebaseAdmin = require('./firebase_admin');
const Policy = require('./policy');

const CONFIG_PATH = path.join(__dirname, 'config.json');
if (!fs.existsSync(CONFIG_PATH)) {
  console.error('Please create config.json from config.example.json');
  process.exit(1);
}
const config = require(CONFIG_PATH);

const collector = new Collector(config);
const analyzer = new Analyzer(config);
const repairer = new Repairer(config);
const admin = new FirebaseAdmin(config);
const policy = new Policy(config);

async function loop() {
  try {
    // 1. Collector: get recent error signatures
    const events = await collector.fetchRecentErrors();
    if (!events || events.length === 0) {
      console.log('No new events.');
      return;
    }

    for (const ev of events) {
      console.log('Processing event:', ev.signature);

      // 2. Analyzer: classify & attempt to synthesize a fix
      const analysis = await analyzer.analyzeEvent(ev);
      if (!analysis) {
        console.log('Analysis failed for', ev.signature);
        continue;
      }
      
      if (!analysis.actionable || !analysis.patch) {
        console.log('No actionable fix suggested for', ev.signature);
        await admin.logEvent('analyzer_no_action', ev, { analysisId: analysis.analysisId, reason: analysis.description });
        await repairer.createIssueForAnalysis(analysis, ev); // Create an issue for tracking
        continue;
      }

      // 3. Policy check: can this be auto-created as PR?
      const blocked = policy.isBlocked(analysis.filesTouched || []);
      if (blocked) {
        console.log('Policy blocks auto-fix for:', analysis.filesTouched);
        await admin.logEvent('policy_block', ev, { analysisId: analysis.analysisId, files: analysis.filesTouched });
        // create a GitHub Issue instead of PR
        await repairer.createIssueForAnalysis(analysis, ev);
        continue;
      }

      // 4. Repairer: create branch + commit patch + PR
      const pr = await repairer.createPRFromAnalysis(analysis, ev);
      if (pr) {
        console.log('PR created:', pr.html_url);
        await admin.logEvent('pr_created', ev, { analysisId: analysis.analysisId, prUrl: pr.html_url, branch: pr.head.ref });
        // Optionally add labels, assignees, open preview deployment...
      } else {
        console.error('Failed to create PR for', ev.signature);
        await admin.logEvent('pr_failed', ev, { analysisId: analysis.analysisId });
      }
    }
  } catch (err) {
    console.error('Loop error', err);
  }
}

async function start() {
  console.log('CrewSphere Watchdog starting...');
  await admin.initialize(); // Initialize Firebase Admin SDK
  const interval = config.pollIntervalSeconds || 60;
  
  while (true) {
    console.log(`\n--- New Watchdog Cycle @ ${new Date().toISOString()} ---`);
    await loop();
    console.log(`--- Cycle complete. Waiting for ${interval} seconds... ---`);
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

start().catch(console.error);
