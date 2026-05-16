import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'release');

if (existsSync(release)) {
  try { rmSync(release, { recursive: true, force: true }); } catch {}
}

mkdirSync(join(release, 'public'), { recursive: true });
cpSync(join(root, 'dist', 'darkmic.exe'), join(release, 'darkmic.exe'));
cpSync(join(root, 'public'), join(release, 'public'), { recursive: true });

console.log('Release ready: release/');
console.log('  release/darkmic.exe');
console.log('  release/public/');
console.log('  (certs/ will be auto-generated on first run)');
