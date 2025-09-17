// analyzer.js
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const simpleGit = require('simple-git');
const fs = require('fs/promises');
const path = require('path');

/**
 * Parses a TypeScript Server log to extract structured information.
 * @param {string} text - The raw log text.
 * @returns {{plugins: string[], oom: boolean, stack: string, messages: string[]}}
 */
function parseTsServerLog(text) {
  const res = { plugins: [], oom: false, stack: '', messages: [] };
  if (!text) return res;
  if (text.match(/OutOfMemory|FATAL ERROR|Allocation failed/i)) res.oom = true;
  
  const pluginRegex = /Plugin (?:'|")?([a-zA-Z0-9_\-\.]+)(?:'|")?/gi;
  let m;
  while ((m = pluginRegex.exec(text)) !== null) {
      if (m[1] && !res.plugins.includes(m[1])) {
        res.plugins.push(m[1]);
      }
  }
  
  const stackMatch = text.match(/(at\s+.*\n(\s+at\s+.*\n)*)/);
  if (stackMatch) res.stack = stackMatch[0].slice(0, 2000);
  
  // extract first 80 lines as messages
  res.messages = text.split('\n').slice(0, 80);
  return res;
}


class Analyzer {
  constructor(config) {
    this.config = config;
    this.llmProvider = config.llm.provider;
    this.apiKey = config.llm.apiKey;
    this.model = config.llm.model;
    this.repoPath = path.join(__dirname, '.tmp_repo');
  }
  
  async setupRepo() {
    const repoUrl = `https://x-access-token:${this.config.github.token}@github.com/${this.config.github.repoOwner}/${this.config.github.repoName}.git`;
    try {
        await fs.access(this.repoPath);
        const git = simpleGit(this.repoPath);
        console.log('Pulling latest changes from repository...');
        await git.pull('origin', this.config.github.defaultBase || 'main');
    } catch {
        console.log('Cloning repository for the first time...');
        await simpleGit().clone(repoUrl, this.repoPath);
    }
  }

  async analyzeEvent(event) {
    const isTsServerLog = event.service && (event.service.includes('tsserver') || event.service.includes('vscode.typescript-language-features'));
    
    let prompt;
    let contextFiles = {};

    // --- CONTEXT GATHERING ---
    await this.setupRepo();
    // Heuristic to find file paths in the error message or stack trace
    const fileRegex = /(\/[a-zA-Z0-9\._-\/]+|[a-zA-Z]:\\[a-zA-Z0-9\._-\\]+)/g;
    const stack = (isTsServerLog ? parseTsServerLog(event.message).stack : '') || event.message;
    const paths = (stack.match(fileRegex) || []).filter(p => p.includes('src/'));

    for (const p of paths.slice(0, 3)) { // Limit to 3 files to keep context small
        const cleanPath = p.split('src/')[1];
        if (cleanPath) {
            const fullPath = path.join(this.repoPath, 'src', cleanPath.split(':')[0]); // remove line numbers
            try {
                await fs.access(fullPath);
                const content = await fs.readFile(fullPath, 'utf8');
                contextFiles[`src/${cleanPath}`] = content;
            } catch (e) {
                console.warn(`Could not read context file: ${fullPath}`);
            }
        }
    }
    
    // --- PROMPT CONSTRUCTION ---
    const contextStr = Object.entries(contextFiles)
      .map(([name, content]) => `--- START FILE: ${name} ---\n${content}\n--- END FILE: ${name} ---`)
      .join('\n\n');

    if (isTsServerLog) {
        const parsedLog = parseTsServerLog(event.message);
        prompt = `
You are an expert TypeScript engineer. Analyze the following tsserver crash log and the provided source code to propose a fix.

Log Details:
- VS Code Version: ${event.metadata?.vscode_version || 'unknown'}
- TypeScript Version: ${event.metadata?.ts_version || 'unknown'}
- OS: ${event.metadata?.os || 'unknown'}
- Out of Memory: ${parsedLog.oom}
- Raw Log Text:
\`\`\`
${parsedLog.messages.join('\n')}
\`\`\`

Relevant Source Code:
${contextStr || "No relevant files could be automatically read."}

Tasks (respond JSON only):
1. actionable: boolean (true if a code patch is possible)
2. category: one of ["tsserver_crash","performance","plugin_conflict","config_error","memory","other"]
3. probable_root_cause: Short sentence describing the likely cause.
4. suggested_fixes: Array of actions. For a code fix, use type "code_patch". The 'patch' key should be a JSON object like {"files": {"path/to/file.ts": "FULL NEW CONTENT OF THE FILE"}}.
5. confidence: 0.0-1.0
6. quick_issue_title: Short title for a GitHub issue.
7. quick_issue_body: Markdown body for a GitHub issue, including reproduction steps if possible.
`;
    } else {
        prompt = `
You are an expert full-stack engineer. Analyze the following error log and relevant source code to propose a fix.

Error Log:
- Service: ${event.service}
- Message: ${event.message}
- Metadata: ${JSON.stringify(event.metadata)}

Relevant Source Code:
${contextStr || "No relevant files could be automatically read."}

Tasks (respond JSON only):
1. actionable: boolean (true if a code patch is possible)
2. probable_root_cause: Short sentence describing the likely cause.
3. suggested_fixes: Array of actions. For a code fix, use type "code_patch". The 'patch' key should be a JSON object like {"files": {"path/to/file.ts": "FULL NEW CONTENT OF THE FILE"}}.
4. confidence: 0.0-1.0
5. quick_issue_title: Short title for a GitHub issue.
6. quick_issue_body: Markdown body for a GitHub issue.
`;
    }

    const llmResp = await this.callLLM(prompt);

    try {
      const parsed = JSON.parse(llmResp);
      parsed.id = uuidv4();
      parsed.generatedAt = new Date().toISOString();
      
      const fix = parsed.suggested_fixes?.[0];

      return {
        actionable: parsed.actionable,
        severity: parsed.severity || event.severity,
        description: parsed.probable_root_cause,
        filesTouched: fix?.type === 'code_patch' ? Object.keys(fix.patch?.files || {}) : [],
        patch: fix?.type === 'code_patch' ? JSON.stringify(fix.patch) : null,
        raw: parsed
      };
    } catch (err) {
      console.error("LLM output was not valid JSON:", llmResp);
      return {
        actionable: false,
        severity: event.severity,
        description: 'LLM output non-JSON; manual review needed',
        filesTouched: [],
        patch: null,
        raw: llmResp
      };
    }
  }

  async callLLM(prompt) {
    if (this.llmProvider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2500,
          temperature: 0.1,
          response_format: { type: "json_object" },
        })
      });
      const json = await resp.json();
      if (!resp.ok || !json.choices || json.choices.length === 0) {
          console.error("LLM API call failed:", json);
          throw new Error(`LLM API error: ${json.error?.message || 'No response'}`);
      }
      return json.choices[0].message.content;
    } else {
      return JSON.stringify({ actionable: false, severity: 'info', description: 'Provider not configured' });
    }
  }
}

module.exports = Analyzer;
