
// analyzer.js
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

class Analyzer {
  constructor(config) {
    this.config = config;
    this.llmProvider = config.llm.provider;
    this.apiKey = config.llm.apiKey;
    this.model = config.llm.model;
  }

  async analyzeEvent(event) {
    // Create a prompt that asks the LLM to:
    // - classify severity
    // - extract probable root cause (file, function)
    // - propose a minimal patch (diff) given repository context
    // For a robust system, you'd fetch the relevant code files and give them to the LLM.
    // Here we build a concise prompt; in production, attach context snippets.

    const prompt = `
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
        raw: parsed
      };
    } catch (err) {
      // Fallback: non-JSON, create a conservative analysis
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
          max_tokens: 1200,
          temperature: 0
        })
      });
      const json = await resp.json();
      return json.choices[0].message.content;
    } else {
      // Genkit or custom provider - user must adapt this section
      // For the PoC, we fallback to a deterministic "no action" reply
      return JSON.stringify({ actionable: false, severity: 'info', description: 'Provider not configured' });
    }
  }
}

module.exports = Analyzer;
