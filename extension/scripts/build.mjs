import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const dist = `${root}dist`;
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: ['background', 'content', 'popup', 'options'].map((n) => `${root}src/${n}.ts`),
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  loader: { '.txt': 'text' },
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});

cpSync(`${root}static`, dist, { recursive: true });
if (existsSync(`${root}icons`)) cpSync(`${root}icons`, `${dist}/icons`, { recursive: true });
console.log('built ->', dist);
