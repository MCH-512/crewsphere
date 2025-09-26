const fs = require('fs');
const path = require('path');

console.log("🔍 Validating project...");

// Check .env.local
if (!fs.existsSync('.env.local')) {
  console.error("❌ .env.local missing. Please create it from .env.local.example");
  process.exit(1);
}

const env = fs.readFileSync('.env.local', 'utf8');
if (!env.includes('GEMINI_API_KEY')) {
  console.error("❌ Gemini API key missing in .env.local");
  process.exit(1);
}

if (!env.includes('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID')) {
  console.error("❌ Firebase Measurement ID missing in .env.local");
  process.exit(1);
}

console.log("✅ Project validated!");
