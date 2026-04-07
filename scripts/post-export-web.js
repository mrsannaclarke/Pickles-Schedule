const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');
const oldNodeModulesDir = path.join(assetsDir, 'node_modules');
const newVendorDir = path.join(assetsDir, 'vendor_modules');
const webJsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
const faviconSvgSource = path.join(projectRoot, 'assets', 'images', 'pickle-favicon.svg');
const faviconSvgTarget = path.join(distDir, 'pickle-favicon.svg');
const publicFontsSource = path.join(projectRoot, 'public', 'fonts');
const distFontsTarget = path.join(distDir, 'fonts');

function replaceInFile(filePath, searchValue, replaceValue) {
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = original.split(searchValue).join(replaceValue);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

function copyDirRecursive(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.log('[post-export-web] dist not found; nothing to patch.');
    return;
  }

  if (fs.existsSync(faviconSvgSource)) {
    fs.copyFileSync(faviconSvgSource, faviconSvgTarget);
    console.log('[post-export-web] Copied pickle-favicon.svg into dist root.');
  }

  if (fs.existsSync(publicFontsSource)) {
    if (fs.existsSync(distFontsTarget)) {
      fs.rmSync(distFontsTarget, { recursive: true, force: true });
    }
    copyDirRecursive(publicFontsSource, distFontsTarget);
    console.log('[post-export-web] Copied public/fonts into dist/fonts.');
  }

  if (fs.existsSync(oldNodeModulesDir)) {
    if (fs.existsSync(newVendorDir)) {
      fs.rmSync(newVendorDir, { recursive: true, force: true });
    }
    fs.renameSync(oldNodeModulesDir, newVendorDir);
    console.log('[post-export-web] Renamed assets/node_modules -> assets/vendor_modules');
  } else {
    console.log('[post-export-web] assets/node_modules not found; no rename needed.');
  }

  if (fs.existsSync(newVendorDir)) {
    const topEntries = fs.readdirSync(newVendorDir, { withFileTypes: true });
    for (const entry of topEntries) {
      if (!entry.isDirectory() || !entry.name.startsWith('@')) continue;
      const encodedName = `%40${entry.name.slice(1)}`;
      const sourcePath = path.join(newVendorDir, entry.name);
      const encodedPath = path.join(newVendorDir, encodedName);
      if (fs.existsSync(encodedPath)) {
        fs.rmSync(encodedPath, { recursive: true, force: true });
      }
      copyDirRecursive(sourcePath, encodedPath);
      console.log(`[post-export-web] Mirrored ${entry.name} -> ${encodedName}`);
    }
  }

  if (!fs.existsSync(webJsDir)) {
    console.log('[post-export-web] web JS bundle dir not found; skipping path rewrite.');
    return;
  }

  const files = fs.readdirSync(webJsDir).filter(name => name.endsWith('.js'));
  let changedCount = 0;

  for (const fileName of files) {
    const fullPath = path.join(webJsDir, fileName);
    const changedA = replaceInFile(fullPath, '/assets/node_modules/', '/assets/vendor_modules/');
    const changedB = replaceInFile(fullPath, 'assets/node_modules/', 'assets/vendor_modules/');
    const changedC = replaceInFile(fullPath, '/assets/vendor_modules/@', '/assets/vendor_modules/%40');
    const changedD = replaceInFile(fullPath, 'assets/vendor_modules/@', 'assets/vendor_modules/%40');
    if (changedA || changedB || changedC || changedD) changedCount += 1;
  }

  console.log(`[post-export-web] Updated bundle path references in ${changedCount} file(s).`);
}

main();
