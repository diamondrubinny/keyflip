# Detection accuracy

How well KeyFlip recognises text typed in the wrong layout, and how it is measured. Re-run with `npm run eval` in `extension/`
(add `STRESS_EN`/`STRESS_HE` pointing at the FrequencyWords `*_full.txt` files for the rare-token stress test).

## How detection works
1. **Dictionaries** (about 135k English and 143k Hebrew words, frequency-ordered) decide whether the typed word is already valid, and whether the converted word is valid in the other language. Short words need to be frequent (3 letters: top 12k); Hebrew accepts up to three one-letter prefixes (ו, ה, ב, ל, מ, ש, כ).
2. **Words valid in both languages** (noise in the word lists, e.g. `tck` = אבל) are flipped only if the other reading is at least 30 times more frequent.
3. **Unknown words** (not in either dictionary) go through a character trigram model per language: flipped only if the converted string looks clearly more like a word of the other language and the typed string looks clearly unlike its own language (length 4+, and Latin words up to 4 letters need a vowel, which keeps abbreviations such as `csrf` and `mkdir` safe).
4. **Context:** after a correction the next words are fixed more readily (a streak), and short words just before a corrected word are repaired too ("kt tck" becomes "לא אבל"). A short word typed alone is never changed: `kt` could be anything.

## Measured on words the detector has never seen
Dictionary cut at 80,000 words; words ranked 80,000-125,000 (names, inflections, rare words) are the unseen test set. Previous version = dictionary-only.

| Metric | Previous | Now |
|---|---|---|
| Hebrew typed on English layout, unseen, 5+ letters | 56.6% | **90.9%** |
| English typed on Hebrew layout, unseen, 5+ letters | 13.2% | **88.0%** |
| Hebrew typed on English layout, unseen, 4 letters | 19.6% | **39.5%** |
| English typed on Hebrew layout, unseen, 4 letters | 9.3% | **63.4%** |
| Frequency-weighted recall, Hebrew typed on English layout | 82.6% | **85.0%** |
| Frequency-weighted recall, English typed on Hebrew layout | 86.7% | **88.6%** |
| Wrongly "fixed" rare unseen English words | 0.68% | 0.81% |
| Wrongly "fixed" rare unseen Hebrew words | 0.23% | 0.27% |
| Stress test, 60k very rare English tokens (names, typos, foreign words) | 0.35% | 0.52% |
| Stress test, 60k very rare Hebrew tokens | 0.14% | 0.18% |
| Tech terms/abbreviations wrongly fixed (100 terms) | 1.6% | 1.0% (`argv`) |

Notes
- The shipped dictionaries are larger than the evaluation's (80k), so real-world unseen words are rarer than in this test.
- Frequency-weighted recall is capped by two- and three-letter words that are also valid in the other language (for example Hebrew `על` typed as `gk`); the streak and repair rules recover many of them in running text but not when a short word stands alone.
- False positives were measured on rare words, which are a small share of real typing; every automatic fix can be undone (`Ctrl+Z` in the browser, `Ctrl+Alt+Space` in the Windows app).
- The test data is movie-subtitle vocabulary (FrequencyWords). Formal, medical or technical text may behave differently. Treat all numbers as indicative.

## Russian (added in 0.2)
Same method (`TARGET=ru npm run eval`), dictionary cut at 80,000 words, unseen words ranked 80,000-125,000:

| Metric | English + Russian | English + Hebrew + Russian |
|---|---|---|
| Russian typed on an English layout, unseen, 5+ letters | 96.6% | 93.3% |
| English typed on a Russian layout, unseen, 5+ letters | 97.4% | 97.4% |
| Frequency-weighted recall (Russian / English) | 89.3% / 89.2% | 88.5% / 89.2% |
| Wrongly "fixed" rare unseen English / Russian words | 0.07% / 0.09% | 1.06% / 0.09% |
| Stress test, rare English / Russian tokens | 0.05% / 0.07% | 0.69% / 0.07% |

Enabling Hebrew next to Russian costs some Russian recall and adds the Hebrew false positives on English words, which is why
optional languages are only on when the user actually uses them. With all three on, Hebrew typed on an English layout drops
from 90.9% to 89.3% (unseen, 5+ letters).

## Arabic (added in 0.2)
`TARGET=ar npm run eval`, same method. The Arabic (101) layout types أ إ آ with Shift (`H`, `Y`, `N`), so these capitals
are read as Arabic letters when Arabic is enabled (with a larger model margin, since capitals are often names), and the
`b` key types لا (two characters; the same text can come from `g` + `h`, both readings are tried).

| Metric | English + Arabic | English + Hebrew + Russian + Arabic |
|---|---|---|
| Arabic typed on an English layout, unseen, 5+ letters | 91.7% | 84.5% |
| English typed on an Arabic layout, unseen, 5+ letters | 93.6% | 93.6% |
| Frequency-weighted recall (Arabic / English) | 86.9% / 89.5% | 85.9% / 89.5% |
| Wrongly "fixed" rare unseen English / Arabic words | 0.12% / 0.18% | 1.17% / 0.18% |
| Stress test, rare English / Arabic tokens | 0.07% / 0.09% | 0.75% / 0.09% |
| Capitalised rare English tokens starting with H/Y/N/B (names) | 0.06-0.07% | |

With all four languages on, Hebrew typed on English drops to 86.2% and Russian to 89.1% (unseen, 5+ letters), and about
1% of rare English words get corrected by mistake, mostly into Hebrew. Optional languages therefore stay off unless used.

## French, German, Spanish (added in 0.3)
These are Latin languages, so they share the keyboard with English and are never confused with it: KeyFlip only fixes text
whose *script* is wrong. Two things change with each of them:
- a **dictionary** (108k French, 100k German, 150k Spanish words), so that French typed in Hebrew mode (`נםמחםור` -> `bonjour`,
  `ב4קדא` -> `c'est`) is recognised, and valid French/German/Spanish words typed on purpose are left alone;
- a **Latin keyboard layout** (`shared/layouts/{fr,de,es}.json`: French AZERTY, German QWERTZ, Spanish), because Hebrew,
  Russian or Arabic typed on such a keyboard comes out differently (`qkuo` on AZERTY is `שלום`). The layouts include the
  letters on the digit row (`2` in Hebrew mode may be `é`), the dead keys (`´` + `a` = `á`) and the mirrored Hebrew brackets.

`LATIN=fr npm run eval` (the Latin language and its layout replace English and US QWERTY), dictionary cut at 80,000, unseen
words ranked 80,000-125,000:

| Metric | French (AZERTY) + Hebrew | German (QWERTZ) + Hebrew | Spanish + Hebrew |
|---|---|---|---|
| Hebrew typed on the Latin keyboard, unseen, 5+ letters | 93.3% | 92.1% | 93.3% |
| Latin language typed in Hebrew mode, unseen, 5+ letters | 92.7% | 92.3% | 91.2% |
| Latin language typed in Hebrew mode, unseen, 4 letters | 73.6% | 60.0% | 58.2% |
| Frequency-weighted recall (Hebrew / Latin language) | 85.8% / 86.6% | 85.6% / 93.3% | 85.7% / 86.6% |
| Wrongly "fixed" rare unseen Latin-language / Hebrew words | 0.35% / 0.08% | 0.46% / 0.14% | 0.60% / 0.13% |
| Stress test, rare French/German/Spanish tokens | 0.20% | 0.29% | 0.48% |

Russian on a French keyboard (`LATIN=fr TARGET=ru`): 96.8% / 96.0% recovered (unseen, 5+ letters), 0.04% / 0.06% wrong.

**Interference.** With English, French, German and Spanish all enabled on US QWERTY (`ALSO=fr,de,es`), Hebrew typed on the
English layout drops from 90.9% to 89.8% (unseen, 5+ letters) and wrong corrections of rare Hebrew words rise from 0.27% to
0.41%, because more Latin readings exist. The English numbers improve (a rare English word may be a common French one).
As with Russian and Arabic, a language is only on when its keyboard is installed (Windows) or it is a browser language.

**Known limits.** On a US QWERTY keyboard French accents cannot be typed at all, so `LATIN=fr LATIN_LAYOUT=us` recovers only
71% of unseen French words typed in Hebrew mode (the rest contain é, è, ç ...). The Belgian, Swiss, Canadian and Latin
American keyboards differ from the three layouts shipped and keep US QWERTY until a layout can be chosen in the settings.
The layout tables were written from the Windows layouts and need checking on a real keyboard before release.
