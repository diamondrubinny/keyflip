import { loadDictionaries } from './dictionaries.ts';
import { Detector } from './detect.ts';
import { manualConvert } from './manual.ts';
import { loadSettings } from './settings.ts';

// One detector for the current set of enabled languages; rebuilt when the user changes them.
let detector: { key: string; value: Promise<Detector> } | null = null;
async function getDetector(): Promise<Detector> {
  const { languages } = await loadSettings();
  const key = languages.join(',');
  if (detector?.key !== key) {
    detector = { key, value: loadDictionaries(languages).then((dicts) => new Detector(dicts)) };
  }
  return detector.value;
}

interface FixRequest {
  type: 'fix';
  token: string;
  streak?: number;
  sandwich?: boolean;
}

interface ManualRequest {
  type: 'manual';
  text: string;
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  // Only our own content scripts may ask; never act on messages from other extensions.
  if (sender.id !== chrome.runtime.id) return false;
  const req = msg as Partial<FixRequest> | Partial<ManualRequest> | { type: 'warmup' };
  if (req.type === 'warmup') {
    void getDetector(); // builds the dictionaries so the first real request is fast
    sendResponse(null);
    return false;
  }
  if (req.type === 'manual') {
    const text = (req as Partial<ManualRequest>).text;
    if (typeof text !== 'string' || text.length > 10_000) return false;
    void getDetector().then(
      (d) => sendResponse(manualConvert(text, d)),
      () => sendResponse(null),
    );
    return true;
  }
  if (req.type !== 'fix') return false;
  const fixReq = req as Partial<FixRequest>;
  if (typeof fixReq.token !== 'string' || fixReq.token.length > 200) return false;
  const token = fixReq.token;
  const streak = Number.isInteger(fixReq.streak) ? Math.min(5, Math.max(0, fixReq.streak as number)) : 0;
  void (async () => {
    const settings = await loadSettings();
    if (!settings.auto) return sendResponse(null);
    const fix = (await getDetector()).fixToken(token, { streak, sandwich: fixReq.sandwich === true });
    if (!fix) return sendResponse(null);
    // enToHe: Latin letters typed by mistake -> another script; heToEn: the other way round.
    const toLatin = /[a-z]/i.test(fix.replacement);
    if ((!toLatin && !settings.enToHe) || (toLatin && !settings.heToEn)) return sendResponse(null);
    sendResponse(fix);
  })().catch(() => sendResponse(null));
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
