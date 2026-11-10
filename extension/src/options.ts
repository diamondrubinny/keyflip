import {
  LANGUAGE_LABELS,
  LATIN_LAYOUT_LABELS,
  OPTIONAL_LANGUAGES,
  loadSettings,
  normalizeHost,
  resetLanguageSettings,
  saveSettings,
} from './settings.ts';
import { LATIN_LAYOUTS, type LatinLayoutId } from './layouts.ts';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** One checkbox per optional language, labelled in the language itself and in Hebrew. */
function buildLanguageList(): void {
  const list = $<HTMLDivElement>('languages');
  for (const id of OPTIONAL_LANGUAGES) {
    const label = document.createElement('label');
    label.className = 'row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `lang-${id}`;
    box.dataset.lang = id;
    label.append(box, ` ${LANGUAGE_LABELS[id]}`);
    list.append(label);
  }
  const select = $<HTMLSelectElement>('latinLayout');
  for (const id of LATIN_LAYOUTS) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = LATIN_LAYOUT_LABELS[id];
    select.append(option);
  }
}

function languageBoxes(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('#languages input[data-lang]')];
}

async function showSettings(): Promise<void> {
  const s = await loadSettings();
  $<HTMLInputElement>('auto').checked = s.auto;
  $<HTMLInputElement>('enToHe').checked = s.enToHe;
  $<HTMLInputElement>('heToEn').checked = s.heToEn;
  for (const box of languageBoxes()) box.checked = s.languages.includes(box.dataset.lang!);
  $<HTMLSelectElement>('latinLayout').value = s.latinLayout;
  $<HTMLTextAreaElement>('hosts').value = s.disabledHosts.join('\n');
}

async function init(): Promise<void> {
  buildLanguageList();
  await showSettings();

  $('save').addEventListener('click', async () => {
    const hosts = $<HTMLTextAreaElement>('hosts')
      .value.split('\n')
      .map(normalizeHost)
      .filter((h): h is string => h !== null);
    const optional = languageBoxes().filter((b) => b.checked).map((b) => b.dataset.lang!);
    await saveSettings({
      auto: $<HTMLInputElement>('auto').checked,
      enToHe: $<HTMLInputElement>('enToHe').checked,
      heToEn: $<HTMLInputElement>('heToEn').checked,
      languages: ['en', 'he', ...optional],
      latinLayout: $<HTMLSelectElement>('latinLayout').value as LatinLayoutId,
      disabledHosts: [...new Set(hosts)],
    });
    $<HTMLTextAreaElement>('hosts').value = [...new Set(hosts)].join('\n');
    $('status').textContent = 'ההגדרות נשמרו';
  });

  $('resetLanguages').addEventListener('click', async () => {
    await resetLanguageSettings();
    await showSettings();
    $('status').textContent = 'השפות והמקלדת נבחרות שוב אוטומטית לפי שפות הדפדפן';
  });
}

void init();
