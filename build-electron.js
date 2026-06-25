const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Ensure .next/standalone exists
if (!fs.existsSync('.next/standalone')) {
  console.error('.next/standalone does not exist. Did you run next build?');
  process.exit(1);
}

// Copy .next/static to .next/standalone/.next/static
copyDir('.next/static', '.next/standalone/.next/static');

// Copy public to .next/standalone/public if it exists
if (fs.existsSync('public')) {
  copyDir('public', '.next/standalone/public');
}

console.log('Electron preparation complete!');
