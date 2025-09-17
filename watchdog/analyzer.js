// analyzer.js
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

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
  }

  async analyzeEvent(event) {
    const isTsServerLog = event.service && (event.service.includes('tsserver') || event.service.includes('vscode.typescript-language-features'));
    
    let prompt;
    if (isTsServerLog) {
        const parsedLog = parseTsServerLog(event.message);
        prompt = `
You are an expert TypeScript engineer and VS Code extension maintainer.

Input: a TypeScript Server (tsserver) crash / log excerpt. The log may contain stack traces, "semantic" log file path, memory errors, plugin names, and file paths. Fields provided: vscode_version, ts_version, os, log_text (raw).

Log Details:
- VS Code Version: ${event.metadata?.vscode_version || 'unknown'}
- TypeScript Version: ${event.metadata?.ts_version || 'unknown'}
- OS: ${event.metadata?.os || 'unknown'}
- Parsed Plugins: ${parsedLog.plugins.join(', ') || 'none'}
- Out of Memory Detected: ${parsedLog.oom}
- Stack Trace Hint: ${parsedLog.stack ? 'present' : 'absent'}
- Raw Log Text:
\`\`\`
${parsedLog.messages.join('\n')}
\`\`\`

Tasks (respond JSON only):
1) actionable: boolean (true if LLM can propose a realistic minimal fix)
2) category: one of ["tsserver_crash","performance","plugin_conflict","config_error","memory","other"]
3) probable_root_cause: short sentence with file/plugin/setting hints
4) reproduction_steps: minimal step list to reproduce locally (max 6 lines)
5) suggested_fixes: array of actions, each { type: "code_patch"|"config_change"|"advice", description: "...", files: ["path1","path2"], patch: "unified-diff or file replacement (only if code_patch)" }
6) confidence: 0-1 (float)
7) quick_issue_title: short title suitable for GitHub issue
8) quick_issue_body: markdown body including "How to reproduce", "Logs excerpt", "Suggested fix", "Priority"

Make conservative fixes only. If unsure, set actionable:false and produce a thorough diagnosis with reproduction steps.
`;
    } else {
        // Generic prompt for other types of events
        prompt = `
You are an expert devops + fullstack engineer. Detect cause from the log and propose a minimal patch.
Event signature: ${event.signature}
Service: ${event.service}
Message: ${event.message}
Metadata: ${JSON.stringify(event.metadata)}

Tasks:
1) Is this actionable? [yes/no] (explain)
2) Short description of bug root cause (file path & function name heuristic).
3) Minimal code patch suggested (unified diff) to fix the issue, or commands to add checks.
4) Files to touch (list).
Respond as JSON: { actionable: bool, severity: "...", description: "...", files: ["..."], patch: "unified-diff or patch body" }
`;
    }

    const llmResp = await this.callLLM(prompt);

    try {
      const parsed = JSON.parse(llmResp);
      parsed.id = uuidv4();
      parsed.generatedAt = new Date().toISOString();
      return {
        actionable: parsed.actionable,
        severity: parsed.severity,
        description: parsed.description,
        filesTouched: parsed.files || [],
        patch: parsed.patch || '',
        raw: parsed // Keep the full structured response from the LLM
      };
    } catch (err) {
      // Fallback: non-JSON, create a conservative analysis
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
    // Simple OpenAI-compatible call (adjust if Genkit)
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
          max_tokens: 1500,
          temperature: 0.1, // Slightly creative for better problem-solving
          response_format: { type: "json_object" }, // Enforce JSON output
        })
      });
      const json = await resp.json();
      if (!resp.ok || !json.choices || json.choices.length === 0) {
          console.error("LLM API call failed:", json);
          throw new Error(`LLM API error: ${json.error?.message || 'No response'}`);
      }
      return json.choices[0].message.content;
    } else {
      // Genkit or custom provider - user must adapt this section
      // For the PoC, we fallback to a deterministic "no action" reply
      return JSON.stringify({ actionable: false, severity: 'info', description: 'Provider not configured' });
    }
  }
}

module.exports = Analyzer;
