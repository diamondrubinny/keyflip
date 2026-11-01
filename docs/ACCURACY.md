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
