import { DEFAULT_LATIN_LAYOUT, LATIN_LAYOUTS, type LatinLayoutId } from './layouts.ts';

/** Languages KeyFlip can detect. English (the Latin side) and Hebrew are always on; the rest are optional. */
export const OPTIONAL_LANGUAGES = ['ru', 'ar', 'fr', 'de', 'es'] as const;

/** Labels for the settings UI: the language's own name, then its Hebrew name. */
export const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  en: 'English – אנגלית',
  he: 'עברית',
  ru: 'Русский – רוסית',
  ar: 'العربية – ערבית',
  fr: 'Français – צרפתית',
  de: 'Deutsch – גרמנית',
  es: 'Español – ספרדית',
};

export const LATIN_LAYOUT_LABELS: Readonly<Record<LatinLayoutId, string>> = {
  us: 'English (US) QWERTY – המקלדת הרגילה בישראל',
  fr: 'Français AZERTY (France)',
  de: 'Deutsch QWERTZ (Deutschland / Österreich)',
  es: 'Español (España)',
};

export interface Settings {
  auto: boolean;
  /** Enabled languages (always includes 'en' and 'he'). */
  languages: string[];
  /** The Latin keyboard layout the user types on ('us', 'fr' = AZERTY, 'de' = QWERTZ, 'es'). */
  latinLayout: LatinLayoutId;
  enToHe: boolean;
  heToEn: boolean;
  disabledHosts: string[];
}

/** Optional languages are on by default when the browser is set up for them (navigator.languages). */
export function defaultLanguages(browserLanguages: readonly string[] = navigator.languages ?? []): string[] {
  const wanted = browserLanguages.map((l) => l.toLowerCase().split('-')[0]);
  return ['en', 'he', ...OPTIONAL_LANGUAGES.filter((l) => wanted.includes(l))];
}

/**
 * The Latin layout a browser language suggests. Only locales whose standard keyboard differs from QWERTY and is
 * the one KeyFlip ships: France (AZERTY), Germany/Austria (QWERTZ), Spain. Canada, Belgium, Switzerland and Latin
 * America use other layouts, so they keep QWERTY until the user chooses.
 */
export function defaultLatinLayout(browserLanguages: readonly string[] = navigator.languages ?? []): LatinLayoutId {
  for (const tag of browserLanguages.map((l) => l.toLowerCase())) {
    if (tag === 'fr-fr' || tag === 'fr') return 'fr';
    if (tag === 'de-de' || tag === 'de-at' || tag === 'de') return 'de';
    if (tag === 'es-es' || tag === 'es') return 'es';
    if (tag.startsWith('en')) return DEFAULT_LATIN_LAYOUT;
  }
  return DEFAULT_LATIN_LAYOUT;
}

export function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return defaultLanguages();
  const optional = OPTIONAL_LANGUAGES.filter((l) => value.includes(l));
  return ['en', 'he', ...optional];
}

export function normalizeLatinLayout(value: unknown): LatinLayoutId {
  return (LATIN_LAYOUTS as readonly string[]).includes(value as string) ? (value as LatinLayoutId) : defaultLatinLayout();
}

export const DEFAULT_SETTINGS: Settings = {
  auto: true,
  languages: ['en', 'he'],
  latinLayout: DEFAULT_LATIN_LAYOUT,
  enToHe: true,
  heToEn: true,
  disabledHosts: [],
};

export async function loadSettings(): Promise<Settings> {
  const { languages: _default, latinLayout: _layout, ...defaults } = DEFAULT_SETTINGS;
  const stored = await chrome.storage.local.get({ ...defaults, languages: null, latinLayout: null } as unknown as Record<string, unknown>);
  return {
    auto: stored.auto !== false,
    languages: normalizeLanguages(stored.languages),
    latinLayout: normalizeLatinLayout(stored.latinLayout),
    enToHe: stored.enToHe !== false,
    heToEn: stored.heToEn !== false,
    disabledHosts: Array.isArray(stored.disabledHosts)
      ? stored.disabledHosts.filter((h): h is string => typeof h === 'string')
      : [],
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch);
}

/** Back to automatic language and keyboard selection (browser languages). */
export async function resetLanguageSettings(): Promise<void> {
  await chrome.storage.local.remove(['languages', 'latinLayout']);
}

export function isHostDisabled(settings: Settings, host: string): boolean {
  const h = host.toLowerCase();
  return settings.disabledHosts.some((d) => h === d || h.endsWith('.' + d));
}

export function normalizeHost(input: string): string | null {
  const v = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  return /^[a-z0-9.-]+$/.test(v) && v.length > 0 ? v : null;
}
