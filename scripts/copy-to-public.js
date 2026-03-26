// scripts/copy-to-public.js
// Copia arquivos finais para a pasta "public" (cross-platform)
const fs = require('fs');
const path = require('path');

const out = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

// Lista de arquivos e pastas que queremos publicar (ajuste se necessário)
const items = [
  'index.html',
  'app.js',
  'styles.css',
  'config.js',
  'readme.md'
];

// copia cada item se existir
items.forEach(name => {
  const src = path.resolve(__dirname, '..', name);
  const dest = path.resolve(out, name);
  if (fs.existsSync(src)) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      // cópia recursiva simples
      copyFolderRecursiveSync(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
});

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  const files = fs.readdirSync(source);
  files.forEach(file => {
    const curSource = path.join(source, file);
    const destPath = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, destPath);
    } else {
      fs.copyFileSync(curSource, destPath);
    }
  });
}

console.log('public directory populated.');