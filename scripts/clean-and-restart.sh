#!/bin/bash
echo "🧹 Cleaning project..."
rm -rf node_modules .next .firebase/aircrew-hub/functions/node_modules
rm -f package-lock.json tsconfig.tsbuildinfo firebase-debug.log firestore-debug.log

echo "🔄 Resetting to last good state..."
git checkout HEAD~1 -- .

echo "📦 Installing dependencies..."
npm install

echo "🔍 Checking TypeScript types..."
npx tsc --noEmit

echo "🚀 Starting development server..."
npm run dev
