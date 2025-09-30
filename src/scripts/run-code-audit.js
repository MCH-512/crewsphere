
// scripts/run-code-audit.js
const { Octokit } = require("@octokit/rest");
const fs = require('fs/promises');
const path = require('path');

// --- Configuration ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || "YOUR_USER_OR_ORG"; // Fallback
const REPO_NAME = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : "crewsphere"; // Fallback
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Main function to run the AI code audit.
 */
async function main() {
    console.log("🤖 CrewSphere Watchdog: Starting proactive code audit...");

    try {
        // We must use dynamic import() here because this script is CommonJS, but the Genkit module is ESM.
        const { ai } = await import(path.resolve(__dirname, '../ai/genkit.js'));

        const sentryContext = "Sentry analysis skipped (configuration missing).";
        const dependabotContext = "No open Dependabot PRs found.";
        const codeContext = await getSourceCodeContext();

        const prompt = `
          You are an expert software architect for CrewSphere, a Next.js/Firebase app.
          Your task is to provide high-impact, non-breaking refactoring suggestions.
          Analyze the following context:
          ## External Context ##
          ${sentryContext}
          ${dependabotContext}
          ## Source Code ##
          ${codeContext}
          ## Instructions ##
          Based on ALL the context, provide a single, high-impact optimization.
          - If Sentry shows frequent 'resource-exhausted' errors for 'getAdminDashboardWeeklyTrends', suggest implementing 'unstable_cache' from 'next/cache' on that function.
          - If no specific external context applies, look for code smells like duplicated logic or performance bottlenecks.
          Respond in JSON format only with the following structure:
          {
            "actionable": <boolean>,
            "analysis_id": "<a unique UUID for this analysis>",
            "quick_issue_title": "<A short, descriptive title for a GitHub pull request, e.g., 'refactor: Centralize airport data fetching'>",
            "quick_issue_body": "<A Markdown-formatted explanation of the problem and the proposed solution.>",
            "suggested_patch": {
                "description": "Concise summary of the code change.",
                "files": { "path/to/file.ts": "THE FULL, NEW, COMPLETE AND FINAL CONTENT OF THE FILE. DO NOT USE DIFFS." }
            }
          }
          If no high-impact action is clear, set "actionable": false.
        `;

        const { text } = await ai.generate({
            model: 'googleai/gemini-1.5-pro-latest',
            prompt: prompt,
            output: { format: "json" },
            config: { temperature: 0.1 },
        });

        if (!text) {
            console.log("✅ AI analysis complete. No actionable improvements suggested.");
            return;
        }

        const analysisResult = JSON.parse(text);

        if (!analysisResult.actionable || !analysisResult.suggested_patch?.files) {
            console.log("✅ AI analysis complete. No code patch suggested.");
            return;
        }

        console.log("💡 AI suggested an actionable patch. Creating outputs for GitHub Actions...");
        const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT;
        if (GITHUB_OUTPUT) {
            await fs.appendFile(GITHUB_OUTPUT, `pr_title=${analysisResult.quick_issue_title}\n`);
            await fs.appendFile(GITHUB_OUTPUT, `pr_body=${analysisResult.quick_issue_body}\n`);
            await fs.appendFile(GITHUB_OUTPUT, `analysis_id=${analysisResult.analysis_id}\n`);
        }

        for (const [filePath, content] of Object.entries(analysisResult.suggested_patch.files)) {
            const fullPath = path.resolve(process.cwd(), filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content);
            console.log(`Patched file: ${filePath}`);
        }

        console.log("✅ Audit finished successfully. Pull Request will be created by the workflow.");

    } catch (error) {
        console.error("AI analysis failed:", error);
        process.exit(1);
    }
}

async function getSourceCodeContext() {
    const filesToAudit = [
        'src/services/admin-dashboard-service.ts',
        'src/components/admin/weekly-trends-chart.tsx',
        'src/app/admin/page.tsx'
    ];
    let contextString = "";
    for (const filePath of filesToAudit) {
        try {
            // Correct the path resolution to go up one level from `scripts` directory
            const fullPath = path.resolve(__dirname, '..', filePath);
            const content = await fs.readFile(fullPath, 'utf8');
            contextString += `--- START FILE: ${filePath} ---\n${content}\n--- END FILE: ${filePath} ---\n\n`;
        } catch (e) {
            console.warn(`Could not read file for proactive audit: ${filePath}`);
        }
    }
    return contextString;
}

main().catch(error => {
    console.error("Watchdog agent failed:", error);
    process.exit(1);
});