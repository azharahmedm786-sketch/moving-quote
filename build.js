const fs = require('fs');

const envConfigPath = './env-config.js';
const examplePath = './env-config.example.js';

let content = '';

if (process.env.FIREBASE_AUTH_KEY || process.env.GOOGLE_MAPS_KEY || process.env.RAZORPAY_KEY) {
  content = `window.ENV = {
  GOOGLE_MAPS_KEY: "${process.env.GOOGLE_MAPS_KEY || ''}",
  FIREBASE_AUTH_KEY: "${process.env.FIREBASE_AUTH_KEY || ''}",
  RAZORPAY_KEY: "${process.env.RAZORPAY_KEY || ''}"
};`;
} else if (fs.existsSync(examplePath)) {
  content = fs.readFileSync(examplePath, 'utf8');
} else {
  content = `window.ENV = {};`;
}

fs.writeFileSync(envConfigPath, content);
console.log('Successfully generated env-config.js');
