const fs = require('fs');
const path = require('path');

console.log("🔍 Checking for missing dependencies...");

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

let missingDependencies = [];

for (const dependency in dependencies) {
    const dependencyPath = path.join(nodeModulesPath, dependency);
    if (!fs.existsSync(dependencyPath)) {
        missingDependencies.push(dependency);
    }
}

if (missingDependencies.length > 0) {
    console.error(`❌ The following dependencies are missing: ${missingDependencies.join(', ')}`);
    console.info("Please run 'npm install' to install them.");
    process.exit(1);
}

console.log("✅ All dependencies are installed.");
