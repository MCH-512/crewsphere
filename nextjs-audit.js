
// nextjs-audit.js
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

// This is a simplified anti-pattern detector as described in the README.
// It looks for a specific anti-pattern: using `fetch` inside `useEffect` in a `page.tsx`.

const ANTI_PATTERN_REGEX = /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*fetch\(/g;

async function auditFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    if (ANTI_PATTERN_REGEX.test(content)) {
        return {
            filePath,
            message: "Found a `fetch` call inside a `useEffect` hook. This can lead to inefficient data fetching. Consider using Server Components or Route Handlers for data fetching.",
        };
    }
    return null;
}

async function runAudit() {
    console.log("🔍 Running Next.js anti-pattern audit...");

    // We only care about page.tsx files inside the app directory
    const files = glob.sync('src/app/**/page.tsx', { absolute: true });
    
    const issues = [];
    for (const file of files) {
        const result = await auditFile(file);
        if (result) {
            issues.push(result);
        }
    }

    if (issues.length > 0) {
        console.error("❌ Audit failed. Found the following issues:");
        issues.forEach(issue => {
            console.error(`- File: ${issue.filePath}`);
            console.error(`  Issue: ${issue.message}`);
        });
        process.exit(1);
    } else {
        console.log("✅ Audit passed. No common anti-patterns detected.");
    }
}

runAudit();
