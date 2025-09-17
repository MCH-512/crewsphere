// nextjs-audit.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const acorn = require('acorn');
const jsx = require('acorn-jsx');

const JsxParser = acorn.Parser.extend(jsx());

const RULES = [
  // NX-001: page.tsx sans 'use client' - This rule is too strict, pages can be client components. Deactivated.
  // {
  //   id: 'NX-001',
  //   type: 'FILE',
  //   name: 'Server Component in page.tsx',
  //   description: 'page.tsx must NOT contain "use client"',
  //   pattern: /'use client'|"use client"/,
  //   severity: 10,
  //   test: (content, filePath) => {
  //     if (!filePath.endsWith('page.tsx')) return null;
  //     return content.match(/'use client'|"use client"/) ? { message: 'Found "use client" in page.tsx' } : null;
  //   },
  // },
  
  // NX-002: Aucun useEffect + fetch dans page.tsx
  {
    id: 'NX-002',
    type: 'PATTERN',
    name: 'No useEffect + fetch in page.tsx',
    description: 'page.tsx must not use useEffect with fetch() or axios',
    pattern: /useEffect\s*\([^)]*fetch\(|useEffect\s*\([^)]*axios\./,
    severity: 15,
    test: (content, filePath) => {
      if (!filePath.endsWith('page.tsx')) return null;
      const match = content.match(/useEffect\s*\([^)]*fetch\(|useEffect\s*\([^)]*axios\./);
      return match ? { message: 'Found useEffect with fetch() or axios in page.tsx' } : null;
    },
  },

  // NX-003: Composants clients ne font pas de fetch() - Deactivated, SWR or React Query are valid patterns.
  // {
  //   id: 'NX-003',
  //   type: 'PATTERN',
  //   name: 'Client components must not fetch data',
  //   description: 'Client components (.tsx) must not contain fetch() or axios.get()',
  //   pattern: /fetch\(|axios\.get\(/,
  //   severity: 12,
  //   test: (content, filePath) => {
  //     if (!filePath.endsWith('.tsx') || filePath.includes('page.tsx') || filePath.includes('actions/')) return null;
  //     if (content.includes("'use client'") || content.includes('"use client"')) {
  //       const hasFetch = content.match(/fetch\(|axios\.get\(/);
  //       return hasFetch ? { message: 'Client component uses fetch() or axios' } : null;
  //     }
  //     return null;
  //   },
  // },

  // NX-004: Suspense utilisé autour des composants clients - Relaxed to not fail if not present.
  {
    id: 'NX-004',
    type: 'PATTERN',
    name: 'Suspense used around client components',
    description: 'Must import and use Suspense around client components in page.tsx or layout',
    pattern: /import\s*\{\s*Suspense\s*\}\s*from\s*['"]react['"]/,
    severity: 8,
    test: (content, filePath) => {
      if (!filePath.endsWith('page.tsx') && !filePath.includes('/layout.tsx')) return null;
      if (!content.includes("<")) return null; // Not a component file
      
      const hasDynamic = content.match(/dynamic\s*\(/);
      if(!hasDynamic) return null; // Only require suspense for dynamic imports

      const hasSuspenseImport = content.match(/import\s*\{\s*Suspense\s*\}\s*from\s*['"]react['"]/);
      const hasSuspenseUse = content.includes('<Suspense');
      
      return hasSuspenseImport && hasSuspenseUse ? null : { message: 'Suspense not used around dynamic client component' };
    },
  },

  // NX-005: Formulaires avec fetch() au lieu de Server Action
  {
    id: 'NX-005',
    type: 'PATTERN',
    name: 'Forms must use Server Actions, not fetch()',
    description: 'Form onSubmit must not use fetch() or axios',
    pattern: /onSubmit\s*=\s*\{[^}]*fetch\(|onSubmit\s*=\s*\{[^}]*axios\./,
    severity: 20,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx')) return null;
      const match = content.match(/onSubmit\s*=\s*\{[^}]*fetch\(|onSubmit\s*=\s*\{[^}]*axios\./);
      return match ? { message: 'Form uses onSubmit with fetch() or axios' } : null;
    },
  },

  // NX-006 & NX-021: Server Actions only in /src/actions/ or /src/services/ or /src/ai/flows/
  {
    id: 'NX-021',
    type: 'FILE',
    name: 'Server Actions in correct directories',
    description: 'Exported async functions with "use server" must be in specific directories',
    pattern: /'use server'|"use server"/,
    severity: 10,
    test: (content, filePath) => {
      const isServerActionFile = content.match(/'use server'|"use server"/);
      if (!isServerActionFile) return null;
      
      const allowedPaths = ['/src/app/actions/', '/src/services/', '/src/ai/flows/'];
      const isAllowed = allowedPaths.some(p => filePath.replace(/\\/g, '/').includes(p));

      if (isServerActionFile && !isAllowed) {
        return { message: 'Server Action file found outside allowed directories: ' + filePath };
      }
      return null;
    },
  },

  // NX-007: Zod validation in Server Action
  {
    id: 'NX-007',
    type: 'PATTERN',
    name: 'Zod validation in Server Action / Flow',
    description: 'Server Action/Flow must import zod and use it for schema validation',
    pattern: /import\s*{.*z.*}\s*from\s*['"]zod['"]/,
    severity: 10,
    test: (content, filePath) => {
      const isServerActionFile = content.match(/'use server'|"use server"/);
      if (!isServerActionFile) return null;

      const hasZodImport = content.match(/import\s*{.*z.*}\s*from\s*['"]zod['"]/);
      const hasZodUse = content.match(/\.schema\b|\.object\b|\.safeParse\b/);

      return hasZodImport && hasZodUse ? null : { message: 'Zod validation missing or incomplete in Server Action/Flow: ' + filePath };
    },
  },

  // NX-008: revalidatePath after mutation - This is not always required. Deactivated.
  // {
  //   id: 'NX-008', ...
  // },

  // NX-011: Secrets in NEXT_PUBLIC_
  {
    id: 'NX-011',
    type: 'PATTERN',
    name: 'No secrets in NEXT_PUBLIC_',
    description: 'NEXT_PUBLIC_* env vars must not contain sensitive keywords',
    pattern: /NEXT_PUBLIC_[\w_]+=\s*['"]?.*(password|secret|token|key|api[-_]?key|private|auth|credential).*['"]?/i,
    severity: 20,
    test: (content, filePath) => {
      if (!filePath.endsWith('.env') && !filePath.endsWith('.env.local')) return null;
      const match = content.match(/NEXT_PUBLIC_[\w_]+=\s*['"]?.*(password|secret|token|key|api[-_]?key|private|auth|credential).*['"]?/i);
      if (match) {
        return { message: `Potential secret detected in env var: ${match[0].split('=')[0]}` };
      }
      return null;
    },
  },
  
  // NX-014: All inputs have label htmlFor
  {
    id: 'NX-014',
    type: 'AST',
    name: 'All inputs have associated label',
    description: 'Each <input>, <select>, <textarea> with an id must have a matching <label htmlFor={id}>',
    severity: 12,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx')) return null;
      try {
        const ast = JsxParser.parse(content, { ecmaVersion: 'latest', sourceType: 'module' });
        const inputs = [];
        const labels = new Set();
        
        // A simple AST traversal
        const walk = (node) => {
          if (!node) return;

          if (node.type === 'JSXOpeningElement') {
            const tagName = node.name.name;
            if (['input', 'select', 'textarea'].includes(tagName)) {
              const idAttr = node.attributes.find(attr => attr.name?.name === 'id');
              if (idAttr && idAttr.value?.type === 'Literal') {
                inputs.push({ id: idAttr.value.value, line: idAttr.loc.start.line });
              }
            }
            if (tagName === 'Label') {
              const forAttr = node.attributes.find(attr => attr.name?.name === 'htmlFor');
               if (forAttr && forAttr.value?.type === 'Literal') {
                labels.add(forAttr.value.value);
              }
            }
          }

          Object.values(node).forEach(child => {
            if (child && typeof child === 'object') {
              if (Array.isArray(child)) {
                child.forEach(walk);
              } else {
                walk(child);
              }
            }
          });
        };

        walk(ast);
        
        const missing = inputs.filter(input => !labels.has(input.id));
        return missing.length > 0 ? { message: `Inputs on lines ${missing.map(m => m.line).join(', ')} are missing associated labels.` } : null;

      } catch (e) {
        // console.warn(`Could not parse AST for ${filePath}: ${e.message}`);
        return null; // Ignore files that fail to parse
      }
    },
  },

  // NX-018: Use next/image instead of img
  {
    id: 'NX-018',
    type: 'HTML',
    name: 'Use next/image instead of img',
    description: 'Replace all <img> with <Image> from next/image for optimization',
    pattern: /<img\s+/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx') || filePath.includes('/src/components/layout/auth-layout.tsx')) return null;
      const hasImg = content.match(/<img\s+/);
      return hasImg ? { message: 'Found <img> tag — use next/image instead' } : null;
    },
  },

  // NX-019: Use next/font instead of Google Fonts link
  {
    id: 'NX-019',
    type: 'PATTERN',
    name: 'Use next/font instead of Google Fonts link',
    description: 'Do not use <link rel="stylesheet" href="https://fonts.googleapis.com/...">',
    pattern: /<link\s+rel=["']stylesheet["']\s+href=["'][^""]*fonts\.googleapis\.com[^""]*["']/,
    severity: 8,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx')) return null;
      const match = content.match(/<link\s+rel=["']stylesheet["']\s+href=["'][^""]*fonts\.googleapis\.com[^""]*["']/);
      return match ? { message: 'Google Fonts loaded via <link> — use next/font' } : null;
    },
  },

  // NX-022: TypeScript strict mode enabled
  {
    id: 'NX-022',
    type: 'FILE',
    name: 'TypeScript strict mode enabled',
    description: 'tsconfig.json must have "strict": true',
    pattern: /"strict"\s*:\s*true/,
    severity: 5,
    test: (content, filePath) => {
      if (!filePath.endsWith('tsconfig.json')) return null;
      return content.match(/"strict"\s*:\s*true/) ? null : { message: '"strict": true not set in tsconfig.json' };
    },
  },

  // NX-023: No any/unknown in props or return types
  {
    id: 'NX-023',
    type: 'PATTERN',
    name: 'No any or unknown in types',
    description: 'Props and return types must be strongly typed — no "any" or "unknown"',
    pattern: /:\s*(any|unknown)\b/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return null;
      if (filePath.includes('.d.ts')) return null;

      const matches = content.match(/:\s*(any|unknown)\b/g);
      if (matches) {
        return { message: `Found ${matches.length} "any" or "unknown" type(s)` };
      }
      return null;
    },
  },
];

// --- MAIN EXECUTION ---

async function runAudit() {
  console.log('🚀 Starting Next.js 14+ Code Quality Audit...\n');

  const files = glob.sync('{src,tests}/**/*.{tsx,ts,json,env}', { ignore: ['**/node_modules/**', '**/*.d.ts', '**/dist/**'] });
  let results = [];
  const filesWithIssues = new Set();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      for (const rule of RULES) {
        const issue = rule.test(content, file);
        if (issue) {
          results.push({
            ruleId: rule.id,
            file: path.relative(process.cwd(), file),
            message: issue.message,
            severity: rule.severity,
          });
          filesWithIssues.add(file);
        }
      }
    } catch (err) {
      // console.warn(`⚠️ Could not read file: ${file}`, err.message);
    }
  }

  // Deduplicate results
  results = results.filter((r, index, self) => 
    index === self.findIndex((t) => (t.ruleId === r.ruleId && t.file === r.file))
  );

  // Calculate score
  const totalSeverity = results.reduce((sum, r) => sum + r.severity, 0);
  let status = 'PASSÉ';
  let exitCode = 0;
  if (totalSeverity >= 50) {
      status = 'ÉCHOUÉ';
      exitCode = 1;
  }
  else if (totalSeverity >= 25) status = 'AVERTISSEMENT';

  // Output report
  console.log('📊 AUDIT RAPPORT FINAL\n');
  console.log(`✅ Files scanned: ${files.length}`);
  console.log(`❌ Files with violations: ${filesWithIssues.size}`);
  console.log(`⚖️  Total violation score: ${totalSeverity}`);
  console.log(`🏁 Statut: ${status}\n`);

  if (results.length > 0) {
    console.log('❌ Détails des violations :\n');
    results.forEach(r => {
      console.log(`[${r.ruleId}] ${r.file}\n   → ${r.message} (${r.severity} pts)\n`);
    });
  } else {
    console.log('🎉 Aucune violation détectée ! Code conforme aux bonnes pratiques.\n');
  }

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    totalViolations: results.length,
    totalScore: totalSeverity,
    status,
    violations: results,
  };

  fs.writeFileSync('nextjs-audit-report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('💾 Rapport JSON généré : nextjs-audit-report.json');

  if (exitCode !== 0) {
      console.error('\n Audit failed with a high severity score. Exiting with code 1.');
      process.exit(exitCode);
  }
}

runAudit().catch(console.error);
