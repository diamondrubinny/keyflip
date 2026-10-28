import { loadDictionaries } from './dictionaries.ts';
import { Detector } from './detect.ts';
import { loadSettings } from './settings.ts';
import { hasHebrew } from './core.ts';

let detector: Detector | null = null;
const getDetector = (): Detector => (detector ??= new Detector(loadDictionaries()));

interface FixRequest {
  type: 'fix';
  token: string;
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  // Only our own content scripts may ask; never act on messages from other extensions.
  if (sender.id !== chrome.runtime.id) return false;
  const req = msg as Partial<FixRequest>;
  if (req.type !== 'fix' || typeof req.token !== 'string' || req.token.length > 200) return false;
  const token = req.token;
  void (async () => {
    const settings = await loadSettings();
    if (!settings.auto) return sendResponse(null);
    const fix = getDetector().fixToken(token);
    if (!fix) return sendResponse(null);
    const toHebrew = hasHebrew(fix.replacement);
    if ((toHebrew && !settings.enToHe) || (!toHebrew && !settings.heToEn)) return sendResponse(null);
    sendResponse(fix);
  })();
  return true; // async response
});

const MENU_ID = 'keyflip-convert';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: chrome.i18n.getMessage('menuConvert'),
    contexts: ['selection', 'editable'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
  void chrome.tabs.sendMessage(tab.id, { type: 'convert' }, { frameId: info.frameId ?? 0 }).catch(() => undefined);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'convert-selection' || tab?.id === undefined) return;
  // Every frame receives it; only the focused frame acts.
  void chrome.tabs.sendMessage(tab.id, { type: 'convert' }).catch(() => undefined);
});
