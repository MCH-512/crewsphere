
const fs = require('fs');
const path = require('path');

console.log("🔍 Validating environment variables...");

const envFilePath = path.resolve(process.cwd(), '.env.local');

// Check if .env.local exists
if (!fs.existsSync(envFilePath)) {
  console.error("❌ .env.local is missing. Please create it from .env.local.example if it exists.");
  process.exit(1);
}

const env = fs.readFileSync(envFilePath, 'utf8');

const requiredKeys = [
  'NEXT_PUBLIC_GEMINI_API_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

let missingKeys = [];

for (const key of requiredKeys) {
    if (!env.includes(key) || env.split(key)[1].trim() === '=') {
        missingKeys.push(key);
    }
}

if (missingKeys.length > 0) {
    console.error(`❌ The following required environment variables are missing or empty in .env.local: ${missingKeys.join(', ')}`);
    console.info("Please refer to the Firebase console to get these values.");
    process.exit(1);
}


// Validate Firebase Measurement ID format
const measurementIdMatch = env.match(/NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=(G-[A-Z0-9]+)/);
if (env.includes('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID') && !measurementIdMatch) {
    console.error('❌ NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is present but has an invalid format. It should be "G-XXXXXXXXXX".');
    process.exit(1);
}


console.log("✅ Environment variables validated!");
