# HANDOFF — CAT's Insurance Journey

Written for the next person or AI session picking this up cold. Everything here was verified on
2026-10-13; the numbers and commands are real, not aspirational. `README.md` is the player/developer
documentation — this file is the **state of the work** document.

---

## 1. What this is

`CAT's Insurance Journey` is a browser-based Property & Casualty (Kansas) study game: **plain HTML +
CSS + JavaScript, no build step, no dependencies, no backend**. It is a harder sequel to
`BranamOps/BAT` ("BAT's Insurance Adventure"), which lives in a **separate repository**. BAT was read
for structural ideas only and is **unmodified** — do not "improve" BAT as part of CAT work.

Target URLs:

- Live site: <https://BranamOps.github.io/CAT/>
- Repository: <https://github.com/BranamOps/CAT>

---

## 2. Status

| Item | State |
| --- | --- |
| Curriculum: 9 levels × 3 lessons, teaching text, source notes | **Done** |
| Question bank: 270 questions (10 per lesson) | **Done** |
| Final exam blueprint: 156 questions / 150 min / no attacks | **Done** |
| Game: timers, ATTACK TIME, pass/retake, story, endings, review | **Done** |
| Theme (`index.html`, `app.css`), responsive layout, original art | **Done** |
| Storyline (country alley cat → the red car → SHADOW CAT → adoption) | **Done — corrected 2026-10-13** |
| Illustrated journey map (BAT-style `assets/world.svg`, 27 stones + red car goal) | **Done — 2026-10-13** |
| README TODO roadmap (art slots, story, gameplay, a11y) | **Done — 2026-10-13** |
| Verification: headless DOM + headless Chromium | **Passing (105/105 and 31/31)** |
| Git history on `main` | **Done — pushed to `BranamOps/CAT` on 2026-10-13** |
| Push to GitHub | **Done — the workspace credential is scoped to CAT** |
| GitHub Pages enabled | **Done — enabled 2026-10-13 (Settings → Pages → Source: GitHub Actions)** |
| Live URL verified | **Done — <https://BranamOps.github.io/CAT/> serves the game (200), 2026-10-13** |

Nothing is half-written. Delivery is complete; every push to `main` redeploys Pages.

---

## 3. The blocker, and exactly how to finish

**Status update (2026-10-13): resolved.** The push succeeded — this session's workspace is
connected to `BranamOps/CAT` itself, so the managed credential is scoped to this repository. Pages
was enabled manually in the GitHub UI (**Settings → Pages → Source: GitHub Actions**), because the
GitHub App cannot create a Pages site (`gh api -X POST repos/BranamOps/CAT/pages` → 403
"Resource not accessible by integration") and cannot dispatch or re-run workflows either (also
403). **A push to `main` is therefore the only deploy trigger** — `gh workflow run` and
`gh run rerun` will not work with this credential. Wait for the "Deploy static content to Pages"
run to go green, then verify with the curl commands at the end of this section.

### Why the push originally failed (historical)

Freebuff injects a GitHub App credential **scoped to the repositories in the App's installation**.
This workspace is connected to `BranamOps/BAT`, so:

```
git push -u origin main
  remote: Permission to BranamOps/CAT.git denied to freebuff-web[bot].
  fatal: ... error: 403

gh api /installation/repositories        → BranamOps/BAT          (CAT absent)
gh api repos/BranamOps/CAT --jq .permissions
  {"admin":false,"maintain":false,"pull":false,"push":false,"triage":false}
```

Creating the repository on GitHub does **not** add it to the App installation. Reads of the public
repo succeed, writes are denied. The fix is an access change, not a credential: **add
`BranamOps/CAT` to the Freebuff GitHub App's repository access** (GitHub → the org/account's
Settings → Applications → the Freebuff/Codebuff App → Configure → Repository access), or
**reconnect the repository in Freebuff** so the session's scope includes CAT. Never ask for a PAT,
SSH key, or remote-URL rewrite, and never persist a token by hand.

### Then run, from this directory

```bash
git push -u origin main                       # 5 commits, branch main
gh api -X POST repos/BranamOps/CAT/pages -f build_type=workflow
gh run list --repo BranamOps/CAT --limit 5    # wait for the Pages run to go green
curl -sS -o /dev/null -w '%{http_code}\n' https://BranamOps.github.io/CAT/
```

Do **not** claim the site works until the last command returns `200` **and** the page loads the
game: `curl -sS https://BranamOps.github.io/CAT/ | grep -o '<title>[^<]*</title>'` should not show
a 404 page. Enabling Pages may also be done in the UI: **Settings → Pages → Source: GitHub Actions**.
The workflow (`.github/workflows/static.yml`) is already committed and needs no edits.

If the push is done by a human instead: extract the distributed zip, `git init -b main`,
`git add .`, `git commit`, `git remote add origin https://github.com/BranamOps/CAT.git`,
`git push -u origin main` — the zip deliberately excludes `.git`, so history starts fresh there.

---

## 4. How to verify (do this after any change)

The two suites are the contract. Both need Node and their library passed by environment variable:

```bash
npm i -D jsdom playwright
npx playwright install --with-deps chromium   # headless Chromium + system libs (needs root/apt)

JSDOM_PATH=./node_modules/jsdom node tools/verify.cjs
PLAYWRIGHT_PATH=./node_modules/playwright node tools/browser-check.cjs
```

Expected: **`105/105 checks passed.`** then **`31/31 browser checks passed.`**. Both exit non-zero on
failure. `browser-check.cjs` also writes screenshots to `/tmp/cat-*.png`.

In the *previous* sandbox the libraries were already installed at
`/home/daytona/.catverify/node_modules/{jsdom,playwright}`, so these worked without reinstalling:

```bash
JSDOM_PATH=/home/daytona/.catverify/node_modules/jsdom node tools/verify.cjs
PLAYWRIGHT_PATH=/home/daytona/.catverify/node_modules/playwright node tools/browser-check.cjs
```

What `verify.cjs` actually asserts: data shape (9 levels, 3 lessons each, 10 questions each, 4
distinct options, valid answer index, non-empty explanation, citations on every question, difficulty
rising strictly by level, answer-key balance), then drives the **real app in jsdom** — lesson start,
question timeout → ATTACK TIME forced hit (clock loses exactly the stolen seconds) and forced miss
(clock untouched), lesson-clock expiry, 100% and 0% runs, fail → retake → pass, exam builds exactly
156 questions across all 27 lessons, exam pass and fail paths, weak-area output, endings, 26 initially
locked lessons, and static-hosting requirements (viewport meta, two breakpoints, small-screen
breakpoint, `prefers-reduced-motion`, no external runtime dependencies, workflow present).

What `browser-check.cjs` asserts: real Chromium at **390×844** and **1366×900** — no console errors,
no horizontal overflow, ≥40 px tap targets, live countdown, forced ATTACK TIME banner, a full lesson
to 100%, and the exam screen showing `1 / 156` with `attacks: None`.

Local play: `python3 -m http.server 4174`. The game lives at <https://BranamOps.github.io/CAT/>, so
the Windows launcher was removed on purpose (GitHub-only, 2026-10-13). Never open `index.html` over
`file://` — the game fetches its JSON.

---

## 5. Layout

```
index.html, app.css, app.js     the game: shell, night-alley theme, all behaviour
data/curriculum.json            levels, lessons, teaching, timers, ATTACK TIME curve, exam blueprint
data/questions.json             270 questions with explanation + citation + difficulty
assets/cat.svg, shadow.svg      original art
assets/Norris ... .pdf          the source manual (46 pages) — the only authoritative source
tools/level1.py … level9.py     question authoring (source of truth for the bank)
tools/build.py                  builds + validates data/*.json from the level modules
tools/verify.cjs                headless-DOM suite (105 checks)
tools/browser-check.cjs         headless-Chromium suite (31 checks)
.github/workflows/static.yml    GitHub Pages deploy on push to main
```

---

## 6. Invariants — do not break these

1. **Never hand-edit `data/curriculum.json` or `data/questions.json`.** They are generated. Change
   `tools/level*.py`, then run `python3 tools/build.py`, which refuses to write unless validation
   passes. Re-running it must leave `git status` clean (it is reproducible).
2. **Question tuple format** (see the header of `tools/level1.py`):
   `(code, difficulty, stem, correct_answer, [3 distractors], explanation, manual_page, pdf_page)`.
   The correct answer is kept **separate from the distractors** so `build.py` can shuffle answer
   positions and balance the key (currently 68/67/68/67, must stay within 15–35% per position).
   Store the *wrong* options only as distractors; never put the correct one in the distractor list.
3. **Difficulty rises strictly by level.** `TARGET_MEANS = [1.4, 1.8, 2.2, 2.5, 2.8, 3.1, 3.5, 3.9,
   4.3]`; the authored relative difficulty inside a level chooses which questions get the higher
   value. This exists because an earlier hand-tagged pass produced Level 4 *easier* than Level 2.
   Build validation and `verify.cjs` both reject a regression. Level 1 must never exceed 2/5 and
   Level 9 is the only level that reaches 5/5.
4. **Every question cites its source**: `Manual p. 1.1 (PDF p. 5).` — both the printed
   section.page label *and* the real PDF page. `build.py` rejects a missing or malformed citation.
5. **Timers and rules** (all in `data/curriculum.json`, consumed by `app.js`): lesson clock 600 s,
   question clock 60 s, pass 80% (8 of 10), ATTACK TIME **only** after a question times out, chance
   `10% + 10% per level` (10→90), steals a random 0–60 s from the lesson clock. Retakes reshuffle the
   order and **reset both clocks**. The final exam is 156 questions in 150 minutes with
   `"noAttacks": true` — the shadow never touches the clock.
6. **Progress** is per-device `localStorage` under the key **`cats-insurance-journey-v1`**
   (`app.js`). Bumping the key is how you'd invalidate old saves; there is no server and no sync.
7. Keep it dependency-free at runtime. `verify.cjs` fails if the CSS/HTML pull anything external.

---

## 7. Source material — one honest gap

The manual's `TEST BREAKDOWN` page also cites a separate **Pre-Study Guide** covering Kansas statutes,
rules and regulations, and some casualty/property terms. That supplement is **not in this repository
and is not publicly available** (researched). **No question is drawn from it and nothing was invented
to fill the gap.** The gap is stated in `README.md` and in the app's study view. If that PDF is ever
supplied, drop it in `assets/`, read it, add the affected topics as new questions in the relevant
`tools/level*.py` modules, and rebuild — the structure already supports it.

---

## 8. Known limitations / not done

- **Pages is unfinished** (§3): the push is done, but the live URL has never been loaded because the
  one-time Pages enablement requires the GitHub UI (the App token gets 403 creating a Pages site).
- The Pages workflow publishes the **repo root**, so the Norris manual PDF is publicly downloadable
  under `/assets/`. That matches what BAT already does. Exclude it only deliberately (the game does
  not read it at runtime; only the authoring/verification tools reference it).
- No server sync, no accounts, no analytics. Progress is per browser.
- A Pages deploy run can fail transiently with "No artifacts named `github-pages` were found" even
  though the upload step succeeds (seen 2026-10-13, run 38368234914) — an artifact-metadata API
  glitch, not a build problem. `gh run rerun` and `gh workflow run` are 403 for this credential, so
  **retry by pushing any commit**; the next run deploys normally.
- **Character art is still the original SVG art.** Generated CAT and SHADOW CAT portraits are pending
  from the user; drop them over `assets/cat.svg` / `assets/shadow.svg` (or provide PNGs and update the
  references). See the README TODO for the full art list.

---

## 9. Traps to avoid

- **Do not commit the distributed zip into BAT.** In the BAT workspace the zip sits at the repo root
  and `CAT/` is an untracked nested repo; "commit all" would push both into `BranamOps/BAT`.
- **Do not stage CAT into BAT's history.** CAT deploys independently; BAT is untouched on purpose.
- **Do not hand-edit `data/*.json`,** and do not "fix" a build failure by weakening `build.py`'s
  validation or `verify.cjs`'s assertions.
- **Do not use destructive git commands** (reset --hard, clean, force-push, history rewrite) on either
  repository.
- In the previous session the BAT workspace's preview command was set to
  `python3 -m http.server 4173 --bind 0.0.0.0` to host the zip download. If you don't want that
  persisted, reset it with `freebuff-preview` or leave it — BAT is a static site either way.

---

## 10. Sensible next steps (not requested yet)

1. Finish §3 so the game is live, then confirm the deployed site plays end to end in a browser.
2. Extend coverage for the missing Pre-Study Guide topics if that PDF turns up (§7).
3. Optional polish: sound, keyboard shortcuts, an explicit "resume lesson" affordance, a printable
   results summary, or storing the exam review so it survives a reload.
