import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('dist');
const destDir = path.resolve('android', 'app', 'src', 'main', 'assets', 'www');

if (!fs.existsSync(srcDir)) {
  console.error('dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Clean old extra js/css in dest/assets to avoid buildup of old hashed bundles
const destAssets = path.join(destDir, 'assets');
if (fs.existsSync(destAssets)) {
  fs.rmSync(destAssets, { recursive: true, force: true });
}

copyRecursiveSync(srcDir, destDir);
console.log('Successfully synced dist/ to android/app/src/main/assets/www');
