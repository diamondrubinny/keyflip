export interface Settings {
  auto: boolean;
  enToHe: boolean;
  heToEn: boolean;
  disabledHosts: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  auto: true,
  enToHe: true,
  heToEn: true,
  disabledHosts: [],
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
  return {
    auto: stored.auto !== false,
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
