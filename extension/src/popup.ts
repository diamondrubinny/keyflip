import { isHostDisabled, loadSettings, normalizeHost, saveSettings } from './settings.ts';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

async function init(): Promise<void> {
  const settings = await loadSettings();
  const auto = $<HTMLInputElement>('auto');
  const site = $<HTMLInputElement>('site');
  auto.checked = settings.auto;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host: string | null = null;
  try {
    host = tab?.url ? normalizeHost(new URL(tab.url).hostname) : null;
  } catch {
    host = null;
  }
  if (!host || !/^https?:/.test(tab?.url ?? '')) {
    site.disabled = true;
    $('siteLabel').textContent = 'האתר הנוכחי אינו נתמך';
  } else {
    $('siteLabel').textContent = `פעיל ב-${host}`;
    site.checked = !isHostDisabled(settings, host);
  }

  const flash = (msg: string): void => {
    $('status').textContent = msg;
  };

  auto.addEventListener('change', async () => {
    await saveSettings({ auto: auto.checked });
    flash(auto.checked ? 'תיקון אוטומטי פעיל' : 'תיקון אוטומטי כבוי');
  });

  site.addEventListener('change', async () => {
    if (!host) return;
    const current = (await loadSettings()).disabledHosts.filter((h) => h !== host);
    await saveSettings({ disabledHosts: site.checked ? current : [...current, host] });
    flash(site.checked ? `הופעל ב-${host}` : `הושבת ב-${host}`);
  });
}

void init();
