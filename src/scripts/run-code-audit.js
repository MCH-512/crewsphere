

'use server';

/**
 * @fileOverview CrewSphere Watchdog Agent
 * This script runs a proactive analysis of the codebase by:
 * 1. Fetching context from external services (Sentry for errors, GitHub for dependency updates).
 * 2. Selecting key source code files for review.
 * 3. Sending the combined context to a Genkit AI model (Gemini).
 * 4. Parsing the AI's response to generate a patch.
 * 5. Creating a Pull Request with the suggested improvements.
 */

const { Octokit } = require("@octokit/rest");
const { ai } = require("../ai/genkit");
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

// --- Helper Functions ---

/**
 * Fetches recent, high-impact errors from Sentry.
 * Focuses on errors from critical components like the admin dashboard chart.
 * @returns {Promise<string>} A summary of relevant Sentry errors.
 */
async function fetchSentryContext() {
  if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
    console.log("Sentry environment variables not set. Skipping Sentry analysis.");
    return "Sentry analysis skipped (configuration missing).";
  }
  try {
    const url = `https://sentry.io/api/0/organizations/${SENTRY_ORG}/issues/?project=${SENTRY_PROJECT}&statsPeriod=7d&query=is:unresolved`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
    });
    if (!response.ok) {
      return `Sentry API request failed: ${response.status} ${response.statusText}`;
    }
    const issues = await response.json();
    const relevantIssues = issues
      .filter((issue) => issue.culprit && issue.culprit.includes('WeeklyTrendsChart'))
      .map((issue) => ({
        title: issue.title,
        count: issue.count,
        culprit: issue.culprit,
      }));
      
    if (relevantIssues.length === 0) {
      return "No high-impact errors detected in key components recently.";
    }
    return `Frequent Sentry Errors (last 7d):\n${JSON.stringify(relevantIssues, null, 2)}`;
  } catch (error) {
    console.error("Failed to fetch Sentry errors:", error);
    return "Could not fetch Sentry error data.";
  }
}

/**
 * Fetches open pull requests from Dependabot and analyzes them for critical dependency updates.
 * @returns {Promise<string>} A summary of important Dependabot PRs.
 */
async function fetchDependabotContext() {
  if (!GITHUB_TOKEN) return "Dependabot analysis skipped (GITHUB_TOKEN missing).";
  try {
    const { data: pulls } = await octokit.pulls.list({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: "open",
      sort: "created",
      direction: "desc",
    });

    const dependabotPRs = pulls.filter(pr => pr.user?.login === "dependabot[bot]");
    if (dependabotPRs.length === 0) {
        return "No open Dependabot PRs found.";
    }

    let suggestions = [];
    for (const pr of dependabotPRs.slice(0, 3)) { // Analyze top 3
      const { data: files } = await octokit.pulls.listFiles({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        pull_number: pr.number,
      });

      if (files.some(file => file.filename === "package.json")) {
        // In a real scenario, we'd parse the patch more carefully. Here, we simplify.
        const patchContent = files[0].patch || '';
        if (patchContent.includes("recharts")) {
          suggestions.push(`- PR #${pr.number} updates 'recharts'. This could impact 'WeeklyTrendsChart'. Suggest adding regression tests.`);
        }
        if (patchContent.includes("firebase")) {
          suggestions.push(`- PR #${pr.number} updates 'firebase'. Recommend verifying authentication and Firestore query components.`);
        }
      }
    }
    return suggestions.length > 0 ? `Pending Dependabot PRs Analysis:\n${suggestions.join("\n")}` : "No critical dependency updates pending.";
  } catch (error) {
    console.error("Failed to analyze Dependabot PRs:", error);
    return "Could not analyze Dependabot PRs.";
  }
}

/**
 * Reads the content of key files to be audited by the AI.
 * @returns {Promise<string>} A string containing the concatenated content of the files.
 */
async function getSourceCodeContext() {
    const filesToAudit = [
        'src/services/admin-dashboard-service.ts',
        'src/components/admin/weekly-trends-chart.tsx',
        'src/app/admin/page.tsx'
    ];

    let contextString = "";
    for (const filePath of filesToAudit) {
        try {
            const fullPath = path.resolve(process.cwd(), filePath);
            const content = await fs.readFile(fullPath, 'utf8');
            contextString += `--- START FILE: ${filePath} ---\n${content}\n--- END FILE: ${filePath} ---\n\n`;
        } catch (e) {
            console.warn(`Could not read file for proactive audit: ${filePath}`);
        }
    }
    return contextString;
}


/**
 * Main function to run the AI code audit.
 */
async function main() {
  console.log("🤖 CrewSphere Watchdog: Starting proactive code audit...");

  // 1. Gather all context
  const [sentryContext, dependabotContext, codeContext] = await Promise.all([
    fetchSentryContext(),
    fetchDependabotContext(),
    getSourceCodeContext(),
  ]);

  // 2. Define the comprehensive prompt for the AI model
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

    - **Critical Security Rule**: Under no circumstances should you ever include secrets, API keys, tokens, or environment variables in your JSON response. Always use placeholders like 'process.env.SECRET_NAME'.
    - If Sentry shows frequent 'resource-exhausted' errors for 'getAdminDashboardWeeklyTrends', suggest implementing 'unstable_cache' from 'next/cache' on that function.
    - If a Dependabot PR updates 'recharts', suggest adding a specific Jest snapshot test for 'WeeklyTrendsChart' to prevent visual regressions.
    - If no specific external context applies, look for code smells like duplicated logic, performance bottlenecks, or opportunities for better state management.

    Respond in JSON format only with the following structure:
    {
      "actionable": <boolean>,
      "analysis_id": "<a unique UUID for this analysis>",
      "quick_issue_title": "<A short, descriptive title for a GitHub pull request, e.g., 'refactor: Centralize airport data fetching'>",
      "quick_issue_body": "<A Markdown-formatted explanation of the problem and the proposed solution. Reference Sentry or Dependabot context if applicable.>",
      "suggested_patch": {
          "description": "Concise summary of the code change.",
          "files": {
              "path/to/file.ts": "THE FULL, NEW, COMPLETE AND FINAL CONTENT OF THE FILE. DO NOT USE DIFFS."
          }
      }
    }

    If no high-impact action is clear, set "actionable": false.
  `;

  // 3. Call the AI model
  console.log("🧠 Sending context to AI for analysis...");
  try {
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
    
    // 4. Output the analysis for the GitHub Action to pick up
    console.log("💡 AI suggested an actionable patch. Creating outputs for GitHub Actions...");
    const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT;
    if (GITHUB_OUTPUT) {
        await fs.appendFile(GITHUB_OUTPUT, `pr_title=${analysisResult.quick_issue_title}\n`);
        await fs.appendFile(GITHUB_OUTPUT, `pr_body=${analysisResult.quick_issue_body}\n`);
        await fs.appendFile(GITHUB_OUTPUT, `analysis_id=${analysisResult.analysis_id}\n`);
    }

    // Apply the patch by overwriting files
    for (const [filePath, content] of Object.entries(analysisResult.suggested_patch.files)) {
        const fullPath = path.resolve(process.cwd(), filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content as string);
        console.log(`Patched file: ${filePath}`);
    }


    console.log("✅ Audit finished successfully. Pull Request will be created by the workflow.");

  } catch (error) {
    console.error("AI analysis failed:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Watchdog agent failed:", error);
  process.exit(1);
});
