import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const root = process.cwd();
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const limits = { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 };
const requiredShots = ['1-chase.jpg', '2-street.jpg', '3-docks.jpg', '4-safehouse.jpg'];
// Keep the hand-in deterministic: no timestamps or generated identifiers enter the dossier.

async function measure(path) {
  let files = 0, bytes = 0;
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      const pathBytes = Buffer.byteLength(relative(path, full));
      if (pathBytes > limits.game_path_max_bytes) throw new Error(`Path exceeds cap: ${full}`);
      if (entry.isDirectory()) { files++; await walk(full); }
      else if (entry.isFile()) { files++; bytes += (await stat(full)).size; }
      else throw new Error(`Unsupported game entry: ${full}`);
    }
  }
  await walk(path);
  if (files > limits.game_max_files || bytes > limits.game_max_bytes) throw new Error(`Game cap exceeded: ${files} files, ${bytes} bytes`);
  return { files, bytes };
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'game'), join(output, 'game'), { recursive: true });
await cp(join(root, 'screenshots'), join(output, 'screenshots'), { recursive: true });
const size = await measure(join(output, 'game'));
if ((await stat(join(output, 'game', 'index.html'))).size > 1048576) throw new Error('Game HTML exceeds one MiB');
const screenshotNames = (await readdir(join(output, 'screenshots'))).filter(name => !name.startsWith('.'));
if (requiredShots.some(name => !screenshotNames.includes(name))) throw new Error('A required Sunset County screenshot is missing');
if (screenshotNames.some(name => !['1-chase.jpg', '2-street.jpg', '3-docks.jpg', '4-safehouse.jpg'].includes(name))) throw new Error('Unexpected screenshot set');
for (const name of screenshotNames) if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png)$/.test(name)) throw new Error(`Invalid screenshot name: ${name}`);
if (screenshotNames.length !== 4) throw new Error('After Hours requires all four gameplay screenshots');
for (const name of screenshotNames) {
  if ((await stat(join(output, 'screenshots', name))).size > limits.screenshots.max_bytes) throw new Error(`Screenshot exceeds cap: ${name}`);
}
const dossier = buildDossier(output, limits);
const dossierBytes = dossier.byteLength;
if (dossierBytes > 1.5 * 1024 * 1024) throw new Error('Dossier exceeds cap');
await writeFile(join(output, 'dossier.json'), dossier);
console.log(`Built ${size.files} game files (${size.bytes} bytes), ${screenshotNames.length} screenshots`);
