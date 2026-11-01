// Measures detection quality on words the detector has NOT seen.
// The dictionary is cut at rank N; words ranked N..N+M are "out of vocabulary" (rare words, names, inflections).
//   recall: wrongly-typed words that are recovered       false positives: correctly-typed words that get "fixed"
// Usage: node --experimental-strip-types scripts/eval.ts [N=80000] [M=45000]
//   LEGACY=<path to an older detect.ts>   compare with an older detector
//   STRESS_EN / STRESS_HE=<*_full.txt>    also measure false positives on very rare tokens (names, typos, foreign words)
import { readFileSync } from 'node:fs';
import { convert } from '../src/core.ts';
import { Detector as Current } from '../src/detect.ts';

const read = (n: string) => readFileSync(new URL(`../src/data/${n}`, import.meta.url), 'utf8').split('\n').filter(Boolean);
const en = read('en.txt');
const he = read('he.txt');
const N = Number(process.argv[2] ?? 80000);
const M = Number(process.argv[3] ?? 45000);

interface Det { fixToken(token: string, opts?: { streak?: number }): { replacement: string } | null }
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(2)}% (${a}/${b})`;

const TECH = ['async', 'await', 'kubectl', 'nginx', 'docker', 'github', 'regex', 'tsconfig', 'localhost', 'webpack', 'eslint', 'params',
  'config', 'argv', 'stdout', 'malloc', 'nullptr', 'enum', 'struct', 'typeof', 'boolean', 'json', 'yaml', 'sudo', 'chmod', 'grep', 'npm',
  'pytest', 'numpy', 'sqlite', 'postgres', 'redis', 'oauth', 'jwt', 'cors', 'csrf', 'xss', 'html', 'css', 'javascript', 'typescript',
  'diamond', 'rubinny', 'tiktok', 'youtube', 'whatsapp', 'gmail', 'chrome', 'windows', 'linux', 'ubuntu', 'wifi', 'bluetooth', 'emoji',
  'http', 'https', 'nosql', 'regexp', 'mkdir', 'rmdir', 'xlsx', 'docx', 'wasm', 'grpc', 'toml', 'dns', 'ssh', 'tcp', 'udp', 'csrf', 'cmdline', 'kwargs', 'args', 'stdin', 'sprintf', 'printf', 'strlen', 'bytes', 'dict', 'tuple', 'lambda', 'pylint', 'mypy', 'gcc', 'clang', 'cmake', 'makefile', 'dockerfile', 'readme', 'changelog',
  'avatar', 'blockchain', 'bitcoin', 'ethereum', 'podcast', 'selfie', 'hashtag', 'unfollow', 'smartphone', 'screenshot'];

function stressTokens(path: string | undefined, re: RegExp, minLen: number): string[] {
  if (!path) return [];
  const out: string[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [w, c] = line.trim().split(' ');
    const count = Number(c);
    if (!w || count >= 20) continue;          // everything above 20 is in the dictionary
    if (count < 4) break;                      // lists are sorted; drop the long tail of one-off junk
    if (re.test(w) && w.length >= minLen) out.push(w);
  }
  return out.filter((_, i) => i % 3 === 0).slice(0, 60000);
}
const stressEn = stressTokens(process.env.STRESS_EN, /^[a-z]+$/, 4);
const stressHe = stressTokens(process.env.STRESS_HE, /^[\u05D0-\u05EA]+$/, 4);

function run(label: string, make: () => Det): void {
  const t0 = Date.now();
  const d = make();
  const build = Date.now() - t0;
  const enOov = en.slice(N, N + M).filter((w) => w.length >= 3);
  const heOov = he.slice(N, N + M).filter((w) => w.length >= 3);
  const rec = (words: string[], toTyped: (w: string) => string, _unused: (t: string) => string, minLen = 0, maxLen = 99, opts = {}) => {
    const set = words.filter((w) => w.length >= minLen && w.length <= maxLen).map((w) => [w, toTyped(w)] as const).filter(([w, t]) => t !== w);
    return pct(set.filter(([w, t]) => d.fixToken(t, opts)?.replacement === w).length, set.length);
  };
  const heTyped = (w: string) => convert(w, 'he-to-en');
  const enTyped = (w: string) => convert(w, 'en-to-he');
  const fp = (words: string[]) => words.filter((w) => d.fixToken(w) !== null);

  const fpEn = fp(enOov), fpHe = fp(heOov), fpTech = fp(TECH);
  console.log(`\n=== ${label} (dict ${N}, build ${build} ms) ===`);
  console.log('OOV recall  HE typed on EN layout  len3  :', rec(heOov, heTyped, (t) => t, 3, 3));
  console.log('OOV recall  HE typed on EN layout  len4  :', rec(heOov, heTyped, (t) => t, 4, 4));
  console.log('OOV recall  HE typed on EN layout  len5+ :', rec(heOov, heTyped, (t) => t, 5));
  console.log('OOV recall  EN typed on HE layout  len3  :', rec(enOov.filter((w) => /^[a-z]+$/.test(w)), enTyped, (t) => t, 3, 3));
  console.log('OOV recall  EN typed on HE layout  len4  :', rec(enOov.filter((w) => /^[a-z]+$/.test(w)), enTyped, (t) => t, 4, 4));
  console.log('OOV recall  EN typed on HE layout  len5+ :', rec(enOov.filter((w) => /^[a-z]+$/.test(w)), enTyped, (t) => t, 5));
  console.log('in-vocab recall HE (top 20k, len3+)      :', rec(he.slice(0, 20000), heTyped, (t) => t, 3));
  console.log('in-vocab recall EN (top 20k, len3+)      :', rec(en.slice(0, 20000).filter((w) => /^[a-z]+$/.test(w)), enTyped, (t) => t, 3));
  console.log('FALSE POSITIVES  OOV English            :', pct(fpEn.length, enOov.length), fpEn.slice(0, 12).join(' '));
  console.log('FALSE POSITIVES  OOV Hebrew             :', pct(fpHe.length, heOov.length), fpHe.slice(0, 12).join(' '));
  console.log('FALSE POSITIVES  tech/brand terms       :', pct(fpTech.length, TECH.length), fpTech.join(' '));
  // Zipf-weighted recall over the whole in-vocabulary range: frequent words matter more.
  const zipf = (words: string[], typed: (w: string) => string) => {
    let hit = 0, all = 0;
    words.forEach((w, i) => { const t = typed(w); if (t === w || w.length < 2) return; const wt = 1 / (i + 10); all += wt; if (d.fixToken(t, { streak: 0 })?.replacement === w) hit += wt; });
    return `${((100 * hit) / all).toFixed(2)}%`;
  };
  console.log('ZIPF-weighted recall HE typed on EN layout:', zipf(he.slice(0, N), heTyped));
  console.log('ZIPF-weighted recall EN typed on HE layout:', zipf(en.slice(0, N).filter((w) => /^[a-z]+$/.test(w)), enTyped));
  if (stressEn.length) {
    const a = fp(stressEn), b = fp(stressHe);
    console.log('STRESS false positives, rare English tokens:', pct(a.length, stressEn.length), a.slice(0, 14).join(' '));
    console.log('STRESS false positives, rare Hebrew tokens :', pct(b.length, stressHe.length), b.slice(0, 14).join(' '));
  }
  const heShort = he.slice(0, 400).filter((w) => w.length === 2);
  console.log('short Hebrew 2-letter words in a streak  :', rec(heShort, heTyped, (t) => t, 2, 2, { streak: 1 }), '| without streak:', rec(heShort, heTyped, (t) => t, 2, 2));
  const enShort = en.slice(0, 400).filter((w) => w.length === 2 && /^[a-z]+$/.test(w));
  const fpShort = [...enShort, ...heShort].filter((w) => d.fixToken(w, { streak: 1 }) !== null);
  console.log('FALSE POSITIVES  valid 2-letter in streak:', pct(fpShort.length, enShort.length + heShort.length), fpShort.join(' '));
}

const dicts = { en: en.slice(0, N), he: he.slice(0, N) };
if (process.env.LEGACY) {
  const { Detector: Legacy } = await import(process.env.LEGACY);
  run('LEGACY', () => new Legacy(dicts));
}
run('CURRENT', () => new Current(dicts));
