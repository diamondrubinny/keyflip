import { loadSettings, normalizeHost, saveSettings } from './settings.ts';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

async function init(): Promise<void> {
  const s = await loadSettings();
  $<HTMLInputElement>('auto').checked = s.auto;
  $<HTMLInputElement>('enToHe').checked = s.enToHe;
  $<HTMLInputElement>('heToEn').checked = s.heToEn;
  $<HTMLTextAreaElement>('hosts').value = s.disabledHosts.join('\n');

  $('save').addEventListener('click', async () => {
    const hosts = $<HTMLTextAreaElement>('hosts')
      .value.split('\n')
      .map(normalizeHost)
      .filter((h): h is string => h !== null);
    await saveSettings({
      auto: $<HTMLInputElement>('auto').checked,
      enToHe: $<HTMLInputElement>('enToHe').checked,
      heToEn: $<HTMLInputElement>('heToEn').checked,
      disabledHosts: [...new Set(hosts)],
    });
    $<HTMLTextAreaElement>('hosts').value = [...new Set(hosts)].join('\n');
    $('status').textContent = 'ההגדרות נשמרו';
  });
}

void init();
