/** Languages KeyFlip can detect. English (the Latin side) and Hebrew are always on; the rest are optional. */
export const OPTIONAL_LANGUAGES = ['ru', 'ar'] as const;

export interface Settings {
  auto: boolean;
  /** Enabled languages (always includes 'en' and 'he'). */
  languages: string[];
  enToHe: boolean;
  heToEn: boolean;
  disabledHosts: string[];
}

/** Optional languages are on by default when the browser is set up for them (navigator.languages). */
export function defaultLanguages(browserLanguages: readonly string[] = navigator.languages ?? []): string[] {
  const wanted = browserLanguages.map((l) => l.toLowerCase().split('-')[0]);
  return ['en', 'he', ...OPTIONAL_LANGUAGES.filter((l) => wanted.includes(l))];
}

export function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return defaultLanguages();
  const optional = OPTIONAL_LANGUAGES.filter((l) => value.includes(l));
  return ['en', 'he', ...optional];
}

export const DEFAULT_SETTINGS: Settings = {
  auto: true,
  languages: ['en', 'he'],
  enToHe: true,
  heToEn: true,
  disabledHosts: [],
};

export async function loadSettings(): Promise<Settings> {
  const { languages: _default, ...defaults } = DEFAULT_SETTINGS;
  const stored = await chrome.storage.local.get({ ...defaults, languages: null } as unknown as Record<string, unknown>);
  return {
    auto: stored.auto !== false,
    languages: normalizeLanguages(stored.languages),
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

export function isHostDisabled(settings: Settings, host: string): boolean {
  const h = host.toLowerCase();
  return settings.disabledHosts.some((d) => h === d || h.endsWith('.' + d));
}

export function normalizeHost(input: string): string | null {
  const v = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  return /^[a-z0-9.-]+$/.test(v) && v.length > 0 ? v : null;
}
