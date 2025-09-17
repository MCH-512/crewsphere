
// repairer_github.js
const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Repairer {
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.github.token });
    this.owner = config.github.repoOwner;
    this.repo = config.github.repoName;
    this.base = config.github.defaultBase || 'main';
    this.localTmp = path.join(__dirname, '.tmp_repo');
  }

  async createIssueForAnalysis(analysis, event) {
    const title = `[auto-analysis] ${analysis.description || event.signature}`;
    const body = `Automated analysis detected issue:

Event: ${event.signature}
Description: ${analysis.description}
Suggested files: ${analysis.filesTouched.join(', ')}

LLM raw: \`\`\`json
${JSON.stringify(analysis.raw, null, 2)}
\`\`\`
`;
    const { data } = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body
    });
    return data;
  }

  async createPRFromAnalysis(analysis, event) {
    // For simplicity: create branch, commit a file patch via GitHub Contents API.
    // If patch touches many files, consider using git locally and push via token.
    const branchName = `watchdog/fix-${Date.now()}`;
    // Create branch from default base
    const baseRef = await this.octokit.git.getRef({ owner: this.owner, repo: this.repo, ref: `heads/${this.base}` });
    const baseSha = baseRef.data.object.sha;
    // Create new branch ref
    await this.octokit.git.createRef({ owner: this.owner, repo: this.repo, ref: `refs/heads/${branchName}`, sha: baseSha });

    // If the LLM returned a unified diff, it's complicated — here we support a simple "file replace" approach:
    // expected: analysis.patch contains one or more file patches in a simplified format:
    // { "files": { "path/to/file.js": "new file content", ... } }
    let patchObj;
    try {
      patchObj = JSON.parse(analysis.patch);
    } catch (err) {
      console.error('Patch is not JSON; creating an Issue instead.');
      return null;
    }
    const touchedFiles = Object.keys(patchObj.files || {});
    for (const filePath of touchedFiles) {
      const content = patchObj.files[filePath];
      // Try to get existing file to obtain sha
      let existingSha = null;
      try {
        const existing = await this.octokit.repos.getContent({ owner: this.owner, repo: this.repo, path: filePath, ref: this.base });
        existingSha = existing.data.sha;
      } catch (err) {
        // file may not exist — create
      }
      // Create or update the file on the branch
      const encoded = Buffer.from(content, 'utf8').toString('base64');
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        message: `[watchdog] auto-fix ${analysis.id} for ${event.signature}`,
        content: encoded,
        branch: branchName,
        sha: existingSha || undefined
      });
    }

    // Create PR
    const prTitle = `[auto-fix][${analysis.severity || 'info'}] ${analysis.description || event.signature}`;
    const prBody = `Auto-generated PR by CrewSphere Watchdog.

Event: ${event.signature}
Analysis id: ${analysis.id}
Files changed: ${touchedFiles.join(', ')}

Policy: auto-created via Watchdog.

LLM raw: \`\`\`json
${JSON.stringify(analysis.raw, null, 2)}
\`\`\`
`;
    const pr = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: prTitle,
      head: branchName,
      base: this.base,
      body: prBody
    });
    return pr.data;
  }
}

module.exports = Repairer;
