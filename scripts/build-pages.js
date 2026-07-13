const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'gh-pages');

execSync('npx ng build public-site --configuration production --base-href /willpowerapp2026/', {
  cwd: root,
  stdio: 'inherit',
});
execSync(
  'npx ng build admin-panel --configuration production --base-href /willpowerapp2026/adminwpuas/',
  { cwd: root, stdio: 'inherit' },
);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(path.join(root, 'dist', 'public-site', 'browser'), outDir, { recursive: true });
fs.cpSync(path.join(root, 'dist', 'admin-panel', 'browser'), path.join(outDir, 'adminwpuas'), {
  recursive: true,
});
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log(`Combined site ready at ${outDir}`);
