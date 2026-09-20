# Commonplace

A personal, static mood-to-quote companion. Type a feeling or a sentence; receive a randomly selected, roughly matching passage from the supplied collection.

The working code is in **`dist/`**. This project is at `/Users/willbalz/Documents/ChatGPT/quote-companion`. The original desktop app and original quote text files are unchanged. GitHub Pages publishing is prepared; the repository has not been connected or published yet. See [PHONE-SETUP.md](PHONE-SETUP.md) for the one-time setup and JSON editing instructions.

## Run

With Python 3 installed, run `npm start`, or `python3 -m http.server 8765 --bind 127.0.0.1 --directory dist`, from this folder and open `http://127.0.0.1:8765/`. Opening `index.html` directly with a `file:` URL will not load the modules and JSON correctly.

The complete deployable app is the `dist/` directory. It has no build requirement, third-party JavaScript, external fonts, API keys, backend, database, LLM calls, embeddings, or model downloads. Matching runs in the browser. There is no app runtime service to pay for. Any future hosting provider's pricing and terms remain separate from the app.

The manifest uses relative URLs for hosting under a subdirectory. A service worker caches public app files on a production origin; it does not cache user inputs. Local preview skips worker registration so edits do not get stuck behind a cache. The GitHub Pages workflow automatically versions app files at each deployment. Quotes use a separate, validated online-first cache, refreshed when the app starts or returns to the foreground. Offline, it uses the last downloaded bank. App-code updates take over after old tabs close.

## Quote bank

- 328 passages: 142 from the *A Confederacy of Dunces* file, 186 from *Pride and Prejudice*.
- **Edit `dist/quotes.json` directly to add, remove, or retag passages.** It is the authoritative bank and publishing never regenerates it. Each entry has a stable ID and individually chosen tags. `sources/quote-tags.tsv` records the original import for reference only.
- All 16 original categories remain. Added: **funny**, **ennui**, and **reflection**.
- A passage can carry several tags. Sarcastic praise is generally tagged funny rather than sincere gratitude. The tags describe the passage's tone, not an endorsement of a character's viewpoint.
- Short context-dependent fragments stay in the bank with reduced selection weight. Original wording and duplicate source entries are retained. Four editorial suffixes are separated into `sourceNote`; the original text is always available in `sources/parsed-quotes.json` and the untouched source text files.
- The five passages identified by the source file as belonging to the foreword are attributed to Walker Percy. This import preserves the supplied collection; it is not an independent transcription check against published editions.

| Quote tone | Passages |
| --- | ---: |
| Funny | 178 |
| Anger / Frustration | 68 |
| Pride | 51 |
| Reflection | 33 |
| Love / Longing | 29 |
| Joy / Gratitude | 24 |
| Ennui | 23 |
| Courage / Resolve | 23 |
| Anxiety / Fear | 22 |
| Calm / Peace | 18 |
| Exhaustion / Burnout | 17 |
| Confusion | 16 |
| Grief / Sadness | 14 |
| Hope | 12 |
| Wonder | 10 |
| Restlessness | 9 |
| Loneliness | 7 |
| Guilt / Regret | 7 |
| Nostalgia | 1 |

Counts overlap because passages have several tones. The collection strongly favors satire; mappings to adjacent tones provide variety for sparse categories.

## How matching works

1. **Normalize without throwing away meaning.** Expand common contractions and curly apostrophes, recognize a few emoji, retain negators and clause boundaries. No broad prefix stemming: “honorary” cannot accidentally match “lonely,” and the “blue” in a blue hat is not sadness.
2. **Recognize the longest phrase first.** “Tired of people” expresses social fatigue, “tired of” suggests frustration, and plain “tired” suggests exhaustion. The vocabulary contains 597 manually specified words and phrases across 24 fixed input moods.
3. **Read local context.** Negation affects nearby matches within a clause, ending at punctuation, conjunctions, or corrective “just.” Intensifiers modify weight. Later contrast clauses get modest emphasis; past feelings and feelings attributed to other people get less. “Not only” and idioms such as “can't stop worrying” have different treatment from ordinary denial.
4. **Combine evidence.** Keep up to three supported moods. A compound rule recognizes low spirits plus acceptance as ennui. A request to be amused can take precedence over the mood being described. Negation provides weaker evidence: denied happiness suggests disappointment; denied sadness alone does not prove joy.
5. **Map input moods to quote tones.** Input moods and quote tags are separate. Acceptance maps toward peace, reflection, and ennui; social fatigue toward peace and exhaustion. The full weights are in `dist/moods.json`, authored by `scripts/build-moods.py`.
6. **Choose with variety.** Score passages against those tone weights, downweight conflicting tones and contextual fragments, and randomly sample from candidates scoring at least 55% of the best result. Avoid the last eight passage IDs when possible, and avoid immediately repeating the same text when alternatives exist. A single eligible passage may repeat.

`createMatcher(moods)` in `dist/matcher.js` returns `analyze`, `rankQuotes`, and `pickQuote`. Analysis includes the primary mood, secondary moods, phrase evidence, denials, rule explanations, and quote-tone weights. It performs no DOM or network operations, so it can be tested independently.

| Input | Direction |
| --- | --- |
| “I'm not happy and I'm ok with that.” | Ennui + acceptance |
| “Not angry, just disappointed.” | Disappointment |
| “I'm alone but not lonely.” | Calm / peace |
| “I can't stop worrying.” | Anxiety / fear |
| “I used to be happy but now I'm miserable.” | Grief / sadness |
| “I'm sad but grateful for my friends.” | Gratitude + sadness |
| “I'm sad, give me something funny.” | Amusement |
| “The sky is blue.” | Unrecognized; a chance encounter |

This is an English heuristic, not general language understanding. Unfamiliar slang, long tangled sentences, sarcasm without explicit cues, and subtle negation will sometimes miss. “Directional” and “mixed” describe rule evidence, not calibrated probabilities or an assessment of the person. Tests cover chosen examples and invariants; they do not establish a measured real-world accuracy rate.

## State and privacy

Mood text and the last 50 pulls exist only in page memory. Reloading clears them. The browser fetches the same static JSON and assets regardless of what is typed. There is no analytics code or input transmission. “Pull another” keeps the same mood; “Change my words” returns to the input for editing. “Why this line?” reveals the inferred direction and the chosen passage's tones.

## Edit and verify

- Add or edit entries and tags directly in `dist/quotes.json`. Nothing else is needed for quote changes.
- Change vocabulary and mood-to-tone mappings in `scripts/build-moods.py`; the original 16-tag vocabulary is preserved in `dist/synonyms.json` as build input.
- Run `npm run build:data` only after editing the mood vocabulary script. It does not touch the quote bank.
- The old `scripts/build-bank.py` now writes a historical reference file under `sources/`; it cannot overwrite the live bank.
- Run `npm test` for parser, selection, and corpus checks.
- Run `npm run check` for entrypoint references, assets, offline file coverage, and JavaScript/JSON syntax.

No npm dependencies or installation are needed. Run the tests and static-file checks before publishing; the workflow also runs them automatically. Interactive testing on a physical phone has not been performed.
