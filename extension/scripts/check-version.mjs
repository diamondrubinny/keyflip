// Fails when the product version differs between the extension and the desktop app.
// Usage: node scripts/check-version.mjs            -> prints the version
//        node scripts/check-version.mjs --github   -> also writes version=<v> to $GITHUB_OUTPUT
import { readFileSync, appendFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const sources = {
  'extension/package.json': JSON.parse(read('extension/package.json')).version,
  'extension/static/manifest.json': JSON.parse(read('extension/static/manifest.json')).version,
  'desktop/Directory.Build.props': /<Version>([^<]+)<\/Version>/.exec(read('desktop/Directory.Build.props'))?.[1],
};

const versions = new Set(Object.values(sources));
if (versions.size !== 1 || versions.has(undefined)) {
  console.error('Version mismatch:', sources);
  process.exit(1);
}
const [version] = versions;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Version "${version}" must be MAJOR.MINOR.PATCH (Chrome manifest rule).`);
  process.exit(1);
}
console.log(version);
if (process.argv.includes('--github') && process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
