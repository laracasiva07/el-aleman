const fs = require('fs');
const path = require('path');

const frontendSrc = path.join(__dirname, '../../../frontend/src');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const matches = [];

  lines.forEach((line, idx) => {
    if (line.includes('dueño') || line.includes('dueno') || line.includes('esDueno') || line.includes('rol')) {
      if (line.includes('dueño') || line.includes('dueno') || line.includes('esDueno')) {
        matches.push({ lineNum: idx + 1, text: line.trim() });
      }
    }
  });

  return matches;
}

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const matches = scanFile(fullPath);
      if (matches.length > 0) {
        results.push({ file: path.relative(frontendSrc, fullPath), matches });
      }
    }
  });
  return results;
}

const report = walkDir(frontendSrc);
console.log(JSON.stringify(report, null, 2));
