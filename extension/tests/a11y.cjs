// Automated WCAG 2.1 A/AA scan (axe-core) of the extension pages. Complements, not replaces, manual testing.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const scheme of ['light', 'dark']) {
    for (const file of ['options.html', 'popup.html']) {
      const page = await browser.newPage({ colorScheme: scheme, viewport: { width: file === 'popup.html' ? 320 : 1000, height: 800 } });
      await page.goto('file://' + path.resolve(__dirname, '../dist', file));
      await page.evaluate(axeSource);
      const res = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }));
      const names = res.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', ');
      console.log(`${res.violations.length ? 'FAIL' : 'PASS'} | ${file} | ${scheme} | ${names}`);
      if (res.violations.length) failed = true;
      await page.close();
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
