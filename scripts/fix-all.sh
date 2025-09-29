#!/bin/bash
echo "🔧 Fixing all TypeScript errors..."

# Supprime les fichiers de build précédents
rm -rf node_modules/.cache
rm -f tsconfig.tsbuildinfo

# Réinstalle les dépendances (optionnel, si vous avez modifié package.json)
# npm install

# Vérifie les types
echo "🔍 Checking TypeScript types..."
npx tsc --noEmit

if [ $? -eq 0 ]; then
  echo "✅ All types are valid!"
else
  echo "❌ Type errors found! Please fix them manually."
  exit 1
fi

# Lance le serveur
echo "🚀 Starting development server..."
npm run dev