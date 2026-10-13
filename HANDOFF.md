# HANDOFF — CAT's Insurance Journey

State-of-the-work notes for the next session. `README.md` is the player/developer documentation;
this file is what is finished, what must not be broken, and how to verify.

---

## 1. What this is

`CAT's Insurance Journey` — a browser-based Kansas Property & Casualty study game. **Plain HTML +
CSS + JavaScript, no build step, no dependencies, no backend.** It is a harder sequel to
`BranamOps/BAT`, which lives in a separate repository.

Target URLs:

- Live site: <https://branamops.github.io/CAT/>
- Repository: <https://github.com/BranamOps/CAT>

## 2. Status

| Item | State |
| --- | --- |
| Curriculum: 9 levels × 3 lessons, teaching text | Done |
| Question bank: 405 questions in CAT's own wording (15 per lesson; 3-5 Kansas-sourced per lesson) | Done |
| Final exam blueprint: 156 questions / 150 min / no attacks | Done |
| Game: timers, ATTACK TIME, pass/retake, story, endings, review | Done |
| CAT young → older switch at lesson 14 | Done |
| Contestant art: three portraits, one random visit per question | Done |
| MOTHER art as the goal (landing) and the ending | Done |
| Keyboard shortcuts (1–4, Enter, Escape) | Done |
| Exam review persisted across reloads | Done |
| Journey map art with barn, windmill, pond, gate | Done |
| Verification: headless DOM + headless Chromium | Passing (167/167 and 39/39) |

## 3. How to verify

```bash
npm i -D jsdom playwright
npx playwright install chromium

JSDOM_PATH=./node_modules/jsdom node tools/verify.cjs
PLAYWRIGHT_PATH=./node_modules/playwright node tools/browser-check.cjs
```

Expected after the Kansas integration: **`167/167 checks passed.`** then **`39/39 browser checks passed.`**
Both suites exit non-zero on failure and print their own `N/N` total, so read the run rather than
assuming this file. Local play: `python3 -m http.server 4174` (never open `index.html` over `file://`
— the game fetches its JSON).

**The bank is generated.** After any edit to `tools/level*.py`, run `python3 tools/build.py` before
playing or testing: the shipped `data/*.json` is stale until then, and the app refuses to boot a bank
whose size or per-lesson counts do not match.

## 4. Invariants — do not break these

1. **Never hand-edit `data/curriculum.json` or `data/questions.json`.** They are generated. Change
   `tools/level*.py`, then run `python3 tools/build.py`. Re-running it must leave `git status` clean.
2. **Question tuple format**: `(code, difficulty, stem, correct_answer, [3 distractors], explanation,
   topic[, origin])`. The correct answer is kept separate from the distractors so `build.py` can
   shuffle answer positions and balance the key (roughly 101 each now; must stay within 15–35% per
   position). The optional eighth element is `"kansas"` for an idea from the Kansas laws and insurance
   material; anything else defaults to `"manual"`. `build.py` requires **three to five** Kansas-tagged
   questions in every lesson, and **strips the tag before the bank ships** so no source is ever cited.
3. **Difficulty rises strictly by level.** `TARGET_MEANS = [1.4 … 4.3]`; the authored relative
   difficulty inside a level decides which questions carry the higher value (45 authored questions per
   level now). Level 1 must never exceed 3/5 and Level 9 must contain 5s.
4. **No question or lesson may reference a source document.** `build.py` rejects any of
   `manual p`, `pdf p`, `training manual`, `pre-study guide`, `kansas laws`, and `norris`, and
   `verify.cjs` re-checks the shipped JSON. Questions name the concept they test in the `topic` field
   instead of citing a page; Kansas-sourced questions test the material in CAT's own words.
5. **Timers and rules** (in `data/curriculum.json`, consumed by `app.js`): lesson clock 600 s,
   question clock 60 s, pass 80% (8 of 10), ATTACK TIME only after a question times out, chance
   `10% + 10% per level` (10→90), steals a random 0–60 s from the lesson clock. The banner and the
   results line always name **the rival who guards that level** (`opponents[level.id]`) — SHADOW CAT
   is only the level 9 rival, so she must never appear in an early lesson. Retakes redraw ten
   questions from the lesson's fifteen and reset both clocks. A randomly chosen contestant portrait
   may appear **at most once per question** and, while it is on screen, both clocks run **three times
   as fast**. The final exam is 156 questions in 150 minutes with `noAttacks: true`.
6. **`adultAtLesson` is 14.** `app.js` `isGrownUp()` switches CAT's artwork from young to older at
   that point. Keep the art files named exactly `assets/CAT_young.jpg` and `assets/CAT_older.jpg`.
7. **Progress** lives in per-device `localStorage` under the key **`cats-insurance-journey-v2`**.
   The saved exam review is `progress.examReview`; `renderExamReview()` renders it.
8. Keep it dependency-free at runtime. `verify.cjs` fails if the CSS/HTML pull anything external,
   and checks that `assets/` contains only the eight game artwork files (`CAT_young`, `CAT_older`,
   `contestant-1`, `contestant-2`, `contestant-3`, `SHADOW-1`, `MOTHER`, `world.svg`).

## 5. Layout

```
index.html, app.css, app.js     the game: shell, night-alley theme, all behaviour
data/curriculum.json            levels, lessons, teaching, timers, ATTACK TIME curve, exam blueprint
data/questions.json             405 questions with explanation + topic + difficulty
assets/CAT_young.jpg            CAT before the halfway point
assets/CAT_older.jpg            CAT after lesson 14 (also the repository-page image)
assets/contestant-1/2/3.jpg     the rivals; one portrait turns up at random, once per question
assets/SHADOW-1.jpg             the final exam opponent
assets/MOTHER.jpg               the goal and the ending
assets/world.svg                the illustrated journey map
tools/level1.py … level9.py     question authoring (source of truth for the bank)
tools/build.py                  builds + validates data/*.json from the level modules
tools/verify.cjs                headless-DOM suite (129 checks)
tools/browser-check.cjs         headless-Chromium suite (34 checks)
.github/workflows/static.yml    GitHub Pages deploy on push to main
```

## 6. Traps to avoid

- **Do not hand-edit `data/*.json`,** and do not "fix" a build failure by weakening `build.py`'s
  validation or `verify.cjs`'s assertions.
- **Do not reintroduce source-document citations.** Questions carry a `topic` label, not a page
  reference.
- **Do not rename the art files** without updating `app.js` (`ART`) and `tools/verify.cjs`.
- **Do not use destructive git commands** (reset --hard, clean, force-push, history rewrite).

## 7. Sensible next steps (not requested yet)

1. Optional polish: sound cues, a printable results summary, per-level story vignettes.
2. Accessibility: `aria-live` announcements for the two countdown clocks and ATTACK TIME.
3. A tiny CI job that runs `tools/build.py` plus both suites on every push.
