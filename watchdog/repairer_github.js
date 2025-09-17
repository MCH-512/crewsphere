// repairer_github.js
const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');
const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Repairer {
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.github.token });
    this.owner = config.github.repoOwner;
    this.repo = config.github.repoName;
    this.base = config.github.defaultBase || 'main';
    this.localRepoPath = path.join(__dirname, '.tmp_repo');
  }

  async createIssueForAnalysis(analysis, event) {
    const title = `[auto-analysis] ${analysis.raw.quick_issue_title || event.signature}`;
    const body = analysis.raw.quick_issue_body || `Automated analysis detected an issue that could not be automatically fixed.
Event: ${event.signature}
Description: ${analysis.description}
Files potentially affected: ${analysis.filesTouched.join(', ')}

---
**LLM Analysis Raw Output:**
\`\`\`json
${JSON.stringify(analysis.raw, null, 2)}
\`\`\`
`;
    const { data } = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      labels: ['ai-detected', 'bug']
    });
    console.log(`Created GitHub issue for non-actionable analysis: #${data.number}`);
    return data;
  }

  async createPRFromAnalysis(analysis, event) {
    let patchObj;
    try {
      patchObj = JSON.parse(analysis.patch);
      if (!patchObj.files || Object.keys(patchObj.files).length === 0) {
        throw new Error("Patch object has no files to modify.");
      }
    } catch (err) {
      console.error('Patch is not valid JSON or is empty; creating an Issue instead.', err.message);
      await this.createIssueForAnalysis(analysis, event);
      return null;
    }
    
    const branchName = `watchdog/fix-${Date.now()}`;
    const git = simpleGit(this.localRepoPath);

    try {
      // 1. Sync with remote
      await git.checkout(this.base).pull('origin', this.base);
      
      // 2. Create new branch
      await git.checkoutLocalBranch(branchName);

      // 3. Write file changes
      const touchedFiles = Object.keys(patchObj.files || {});
      for (const filePath of touchedFiles) {
        const content = patchObj.files[filePath];
        const fullPath = path.join(this.localRepoPath, filePath);
        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content);
        await git.add(fullPath);
      }

      // 4. Commit changes
      const commitMessage = `fix(auto): ${analysis.raw.quick_issue_title || event.signature}\n\nAnalysis ID: ${analysis.analysisId}`;
      await git.commit(commitMessage);

      // 5. Push to remote
      await git.push('origin', branchName);

      // 6. Create Pull Request
      const prTitle = `fix(watchdog): ${analysis.raw.quick_issue_title}`;
      const prBody = analysis.raw.quick_issue_body || `Auto-generated PR by CrewSphere Watchdog.
        
**Analysis ID:** ${analysis.analysisId}
**Event Signature:** \`${event.signature}\`

This PR attempts to fix the issue described above. Please review carefully.
`;
      const { data: pr } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: prTitle,
        head: branchName,
        base: this.base,
        body: prBody,
      });

      return pr;

    } catch (error) {
        console.error(`Failed to create PR via local git workflow:`, error);
        // Fallback or cleanup
        await git.checkout(this.base);
        // You might want to delete the failed local branch
        try { await git.deleteLocalBranch(branchName, true); } catch (e) {}
        return null;
    }
  }
}

module.exports = Repairer;
