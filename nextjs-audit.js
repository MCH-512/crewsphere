// nextjs-audit.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const acorn = require('acorn');
const { parse } = require('acorn-import-assertions');

const RULES = [
  // NX-001: page.tsx sans 'use client'
  {
    id: 'NX-001',
    type: 'FILE',
    name: 'Server Component in page.tsx',
    description: 'page.tsx must NOT contain "use client"',
    pattern: /'use client'|"use client"/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.endsWith('page.tsx')) return null;
      return content.match(/'use client'|"use client"/) ? { message: 'Found "use client" in page.tsx' } : null;
    },
  },

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

  // NX-003: Composants clients ne font pas de fetch()
  {
    id: 'NX-003',
    type: 'PATTERN',
    name: 'Client components must not fetch data',
    description: 'Client components (.tsx) must not contain fetch() or axios.get()',
    pattern: /fetch\(|axios\.get\(/,
    severity: 12,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx') || filePath.includes('page.tsx') || filePath.includes('actions/')) return null;
      if (content.includes("'use client'") || content.includes('"use client"')) {
        const hasFetch = content.match(/fetch\(|axios\.get\(/);
        return hasFetch ? { message: 'Client component uses fetch() or axios' } : null;
      }
      return null;
    },
  },

  // NX-004: Suspense utilisé autour des composants clients
  {
    id: 'NX-004',
    type: 'PATTERN',
    name: 'Suspense used around client components',
    description: 'Must import and use Suspense around client components in page.tsx or layout',
    pattern: /import\s*\{\s*Suspense\s*\}\s*from\s*['"]react['"]/,
    severity: 8,
    test: (content, filePath) => {
      if (!filePath.endsWith('page.tsx') && !filePath.includes('/layout.tsx')) return null;
      const hasImport = content.match(/import\s*\{\s*Suspense\s*\}\s*from\s*['"]react['"]/);
      const hasUse = content.includes('<Suspense') || content.includes('Suspense(');
      return hasImport && hasUse ? null : { message: 'Suspense not imported or used in page/layout' };
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

  // NX-006: Server Actions only in /src/actions/
  {
    id: 'NX-006',
    type: 'FUNCTION',
    name: 'Server Actions must be in /src/actions/',
    description: 'Exported async functions must be located in src/actions/ directory',
    pattern: /export\s+async\s+function/,
    severity: 10,
    test: (content, filePath) => {
      if (filePath.includes('actions/') && content.match(/export\s+async\s+function/)) return null;
      if (content.match(/export\s+async\s+function/)) {
        return { message: 'Server Action found outside /src/actions/: ' + filePath };
      }
      return null;
    },
  },

  // NX-007: Zod validation in Server Action
  {
    id: 'NX-007',
    type: 'PATTERN',
    name: 'Server Action uses Zod validation',
    description: 'Server Action must import zod and use .safeParse()',
    pattern: /import\s*\{\s*z\s*\}\s*from\s*['"]zod['"]/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.includes('actions/') || !content.match(/export\s+async\s+function/)) return null;
      const hasZod = content.match(/import\s*\{\s*z\s*\}\s*from\s*['"]zod['"]/);
      const hasSafeParse = content.match(/\b(z\.schema|z\.object)\s*\(\s*\{[\s\S]*?\}\s*\)\.safeParse\(/);
      return hasZod && hasSafeParse ? null : { message: 'Zod validation missing or incomplete in Server Action' };
    },
  },

  // NX-008: revalidatePath after mutation
  {
    id: 'NX-008',
    type: 'PATTERN',
    name: 'revalidatePath called after mutation',
    description: 'Server Action must call revalidatePath() after successful prisma update',
    pattern: /import\s*\{\s*revalidatePath\s*\}\s*from\s*['"]next\/cache['"]/,
    severity: 8,
    test: (content, filePath) => {
      if (!filePath.includes('actions/') || !content.match(/export\s+async\s+function/)) return null;
      const hasImport = content.match(/import\s*\{\s*revalidatePath\s*\}\s*from\s*['"]next\/cache['"]/);
      const hasCall = content.match(/revalidatePath\(['"][^'"]+['"]\)/);
      return hasImport && hasCall ? null : { message: 'revalidatePath() not imported or called in Server Action' };
    },
  },

  // NX-009: useState for API data
  {
    id: 'NX-009',
    type: 'PATTERN',
    name: 'No useState for API data',
    description: 'useState should not store data fetched from API',
    pattern: /const\s+\[.*,\s*set[A-Z].*\]\s*=\s*useState\(/,
    severity: 15,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx') || filePath.includes('page.tsx')) return null;
      const hasState = content.match(/const\s+\[.*,\s*set[A-Z].*\]\s*=\s*useState\(/);
      if (!hasState) return null;
      const hasFetchInScope = content.match(/fetch\(|axios\.get\(/);
      return hasFetchInScope ? { message: 'useState used to store API data' } : null;
    },
  },

  // NX-010: getSession() in Server Action
  {
    id: 'NX-010',
    type: 'PATTERN',
    name: 'getSession() called in Server Action',
    description: 'Every Server Action must verify session via getSession()',
    pattern: /import\s*\{\s*getSession\s*\}\s*from\s*['"][^'"]+['"]/,
    severity: 15,
    test: (content, filePath) => {
      if (!filePath.includes('actions/') || !content.match(/export\s+async\s+function/)) return null;
      const hasGetSession = content.match(/import\s*\{\s*getSession\s*\}\s*from\s*['"][^'"]+['"]/);
      const hasCall = content.match(/await\s+getSession\(/);
      return hasGetSession && hasCall ? null : { message: 'getSession() not imported or called in Server Action' };
    },
  },

  // NX-011: Secrets in NEXT_PUBLIC_
  {
    id: 'NX-011',
    type: 'PATTERN',
    name: 'No secrets in NEXT_PUBLIC_',
    description: 'NEXT_PUBLIC_* env vars must not contain passwords, tokens, keys',
    pattern: /NEXT_PUBLIC_[A-Z_]+=['"](?:.*?(?:password|secret|token|key|api_key|private_key|auth|credential).*?)/i,
    severity: 20,
    test: (content, filePath) => {
      if (!filePath.endsWith('.env') && !filePath.endsWith('.env.local')) return null;
      const match = content.match(/NEXT_PUBLIC_[A-Z_]+=['"](.*)['"]/);
      if (match && /password|secret|token|key|api_key|private_key|auth|credential/i.test(match[1])) {
        return { message: `Secret detected in ${match[0]}` };
      }
      return null;
    },
  },

  // NX-012: Password hashing with bcrypt/scrypt
  {
    id: 'NX-012',
    type: 'PATTERN',
    name: 'Password hashed with bcrypt/scrypt',
    description: 'Must use bcrypt or argon2, never plaintext or md5/sha1',
    pattern: /(bcrypt|argon2)\.hashSync?\s*\(|(md5|sha1)\s*\(/,
    severity: 15,
    test: (content, filePath) => {
      if (!filePath.includes('actions/') || !content.match(/export\s+async\s+function/)) return null;
      const hasBadHash = content.match(/(md5|sha1)\s*\(/);
      const hasGoodHash = content.match(/(bcrypt|argon2)\.hashSync?\s*\(/);
      if (hasBadHash) return { message: 'Insecure hash function (md5/sha1) detected' };
      if (!hasGoodHash) return { message: 'No secure password hashing (bcrypt/argon2) found' };
      return null;
    },
  },

  // NX-013: Audit log on sensitive actions
  {
    id: 'NX-013',
    type: 'PATTERN',
    name: 'Audit log created on sensitive actions',
    description: 'CREATE auditLog entry on CHANGE_PASSWORD, DELETE_ACCOUNT, UPDATE_EMAIL',
    pattern: /prisma\.auditLog\.create\(/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.includes('actions/') || !content.match(/export\s+async\s+function/)) return null;
      const hasAudit = content.match(/prisma\.auditLog\.create\(/);
      const isSensitive = content.match(/(CHANGE_PASSWORD|DELETE_ACCOUNT|UPDATE_EMAIL)/);
      return hasAudit && isSensitive ? null : { message: 'Audit log missing for sensitive action' };
    },
  },

  // NX-014: All inputs have label htmlFor
  {
    id: 'NX-014',
    type: 'HTML',
    name: 'All inputs have associated label',
    description: 'Each <input>, <select>, <textarea> must have a matching <label htmlFor="...">',
    pattern: /<input\b|<select\b|<textarea\b/g,
    severity: 12,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx')) return null;
      const inputs = [...content.matchAll(/<(input|select|textarea)\s+[^>]*id\s*=\s*["']([^"']+)["'][^>]*>/gi)];
      const labels = [...content.matchAll(/<label\s+for\s*=\s*["']([^"']+)["'][^>]*>/gi)];

      const inputIds = inputs.map(m => m[2]);
      const labelForIds = labels.map(m => m[1]);

      const missing = inputIds.filter(id => !labelForIds.includes(id));
      return missing.length > 0 ? { message: `Inputs without labels: ${missing.join(', ')}` } : null;
    },
  },

  // NX-015: aria-invalid + aria-describedby on invalid fields
  {
    id: 'NX-015',
    type: 'HTML',
    name: 'Invalid fields have aria-invalid and aria-describedby',
    description: 'Input with error must have aria-invalid="true" and aria-describedby="error-id"',
    pattern: /aria-invalid\s*=\s*["']false["']|aria-invalid\s*=\s*["']true["']/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx')) return null;
      const inputsWithErrors = [...content.matchAll(/<input[^>]*class\s*=\s*["'][^"']*text-red-500[^"']*["'][^>]*>/gi)];
      const hasAriaInvalid = [...content.matchAll(/aria-invalid\s*=\s*["']true["']/gi)];
      const hasAriaDescribedBy = [...content.matchAll(/aria-describedby\s*=\s*["'][^""]+["']/gi)];

      if (inputsWithErrors.length > 0 && hasAriaInvalid.length === 0) {
        return { message: 'Error state input lacks aria-invalid="true"' };
      }
      if (inputsWithErrors.length > 0 && hasAriaDescribedBy.length === 0) {
        return { message: 'Error state input lacks aria-describedby' };
      }
      return null;
    },
  },

  // NX-016: Modal role="dialog" and aria-modal
  {
    id: 'NX-016',
    type: 'HTML',
    name: 'Modal has role="dialog" and aria-modal="true"',
    description: 'Modal containers must have role="dialog" and aria-modal="true"',
    pattern: /role\s*=\s*["']dialog["']|aria-modal\s*=\s*["']true["']/,
    severity: 15,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx')) return null;
      const hasModalDiv = content.match(/<div[^>]*>([\s\S]*?)<\/div>/g)?.some(div =>
        div.includes('modal') || div.includes('Dialog') || div.includes('Modal')
      );
      if (!hasModalDiv) return null;

      const hasRole = content.match(/role\s*=\s*["']dialog["']/);
      const hasAriaModal = content.match(/aria-modal\s*=\s*["']true["']/);
      if (!hasRole || !hasAriaModal) {
        return { message: 'Modal missing role="dialog" or aria-modal="true"' };
      }
      return null;
    },
  },

  // NX-017: Contrast ratio >= 4.5:1 (basic heuristic)
  {
    id: 'NX-017',
    type: 'PATTERN',
    name: 'Text contrast >= 4.5:1',
    description: 'Avoid light gray (#777) on white background',
    pattern: /color:\s*["']?#?([a-fA-F0-9]{3}|[a-fA-F0-9]{6})["']?;?.*background-color:\s*["']?#?ffffff["']?/i,
    severity: 8,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx') && !filePath.endsWith('.css')) return null;
      const lowContrast = content.match(/color:\s*["']?#?([789aA][a-fA-F0-9]{2}|[789aA][a-fA-F0-9])["']?;?.*background-color:\s*["']?#?ffffff["']?/i);
      if (lowContrast) return { message: 'Low contrast text (light gray on white)' };
      return null;
    },
  },

  // NX-018: Use next/image instead of img
  {
    id: 'NX-018',
    type: 'HTML',
    name: 'Use next/image instead of img',
    description: 'Replace all <img> with <Image> from next/image',
    pattern: /<img\s+/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx')) return null;
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

  // NX-020: No useEffect + fetch in client components
  {
    id: 'NX-020',
    type: 'PATTERN',
    name: 'No useEffect + fetch in client components',
    description: 'Client components must not use useEffect(() => fetch(...))',
    pattern: /useEffect\s*\(\s*\(.*?\)\s*=>\s*fetch\(/,
    severity: 15,
    test: (content, filePath) => {
      if (!filePath.endsWith('.tsx') || filePath.includes('page.tsx')) return null;
      if (!content.includes("'use client'") && !content.includes('"use client"')) return null;
      const match = content.match(/useEffect\s*\(\s*\(.*?\)\s*=>\s*fetch\(/);
      return match ? { message: 'Client component uses useEffect with fetch()' } : null;
    },
  },

  // NX-021: Server Actions in /src/actions/
  {
    id: 'NX-021',
    type: 'FILE',
    name: 'Server Actions in /src/actions/',
    description: 'Exported async functions must be in /src/actions/',
    pattern: /export\s+async\s+function/,
    severity: 10,
    test: (content, filePath) => {
      if (filePath.includes('actions/') && content.match(/export\s+async\s+function/)) return null;
      if (content.match(/export\s+async\s+function/)) {
        return { message: 'Server Action found outside /src/actions/: ' + filePath };
      }
      return null;
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
      if (filePath !== 'tsconfig.json') return null;
      return content.match(/"strict"\s*:\s*true/) ? null : { message: '"strict": true not set in tsconfig.json' };
    },
  },

  // NX-023: No any/unknown in props or return types
  {
    id: 'NX-023',
    type: 'PATTERN',
    name: 'No any or unknown in types',
    description: 'Props and return types must be strongly typed — no "any" or "unknown"',
    pattern: /\b(any|unknown)\b(?!\s*<)/,
    severity: 10,
    test: (content, filePath) => {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return null;
      const hasAny = content.match(/\bany\b(?!\s*<)/);
      const hasUnknown = content.match(/\bunknown\b(?!\s*<)/);
      if (hasAny || hasUnknown) {
        return { message: 'Found "any" or "unknown" type — use proper interface' };
      }
      return null;
    },
  },
];

// --- MAIN EXECUTION ---

async function runAudit() {
  console.log('🚀 Starting Next.js 14+ Audit...\n');

  const files = glob.sync('src/**/*.{tsx,ts,json,env}', { ignore: ['src/**/*.d.ts', 'node_modules/**'] });
  const results = [];

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
        }
      }
    } catch (err) {
      console.warn(`⚠️ Could not read file: ${file}`, err.message);
    }
  }

  // Calculate score
  const totalSeverity = results.reduce((sum, r) => sum + r.severity, 0);
  let status = 'PASSÉ';
  if (totalSeverity >= 71) status = 'ÉCHOUÉ';
  else if (totalSeverity >= 31) status = 'AVERTISSEMENT';

  // Output report
  console.log('📊 AUDIT RAPPORT FINAL\n');
  console.log(`✅ Total violations: ${results.length}`);
  console.log(`⚖️  Score total: ${totalSeverity}/200`);
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
    rules: RULES.map(r => ({ id: r.id, name: r.name, severity: r.severity })),
  };

  fs.writeFileSync('nextjs-audit-report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('💾 Rapport JSON généré : nextjs-audit-report.json');
}

runAudit().catch(console.error);
