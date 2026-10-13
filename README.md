# CAT's Insurance Journey

A browser-based Property & Casualty learning adventure for Kansas, and a **harder sequel** to
[BAT's Insurance Adventure](https://github.com/BranamOps/BAT). CAT is a backyard alley cat from the
country who survived on human scraps and made it through every winter on what people left behind.
Other cats tested her along the way — not with claws, but with insurance knowledge. For a long time
her only goal was survival, until the day she saw the red car and decided she would leave with it.
Now she walks nine levels of increasingly difficult — but entirely harmless — intellectual battles,
ending with a final exam against SHADOW CAT, her own shadow.

**Play online:** <https://BranamOps.github.io/CAT/>

**Source repository:** <https://github.com/BranamOps/CAT>

CAT is a separate project. BAT's code was inspected and its structure adapted, but BAT itself is
unaltered; the two games live in independent repositories and deploy independently.

## Source material

Every lesson and every question is grounded in the supplied training manual:

- `assets/Norris Property and Casualty Training Manual Book 2.pdf` — *Property & Casualty Training
  Manual, Book #2 (Norris Training System, Rev. 2024)*, 46 pages.

Each question carries a citation of the form `Manual p. 2.3 (PDF p. 16)`, naming both the **printed
section.page label** and the **actual PDF page**, so any answer can be checked against the source.
Nothing about coverage is invented: if the manual does not say it, it is not asked.

**One caveat, stated plainly.** The manual's `TEST BREAKDOWN` page also cites a separate
**Pre-Study Guide** for several topic groups (Kansas statutes, rules and regulations, and some
casualty and property terms). That supplement is **not in this repository and is not publicly
available**, so no question is drawn from it. Nothing has been inferred to fill the gap. Adding that
PDF to `assets/` would allow the affected topics to be extended.

## The journey

Nine levels, three lessons each — twenty-seven lessons in all, ten questions per lesson. Question
difficulty is calibrated to rise strictly with the level: the average question difficulty climbs from
**1.40 at Level 1** to **4.30 at Level 9**, and Level 9 is the only level that reaches 5 of 5.

| Level | Title | Opponent | ATTACK TIME chance |
| --- | --- | --- | --- |
| 1 | The Cold Alley | The Alley Tom | 10% |
| 2 | The Warm Doorstep | The Porch Cat | 20% |
| 3 | The Garden Path | The Garden Tabby | 30% |
| 4 | The Sunny Wall | The Wall Cat | 40% |
| 5 | The Rooftop Run | The Rooftop Tom | 50% |
| 6 | The Outer Yards | The Yard Cat | 60% |
| 7 | The Night Watch | The Night Cat | 70% |
| 8 | The Highway Verge | The Highway Cat | 80% |
| 9 | The Long Shadow | SHADOW CAT | 90% |

## How a lesson runs

1. **Study** the lesson, its three teaching sections, its scenario, and its source pages.
2. **Answer ten questions.** Every answer immediately shows a teaching explanation and a manual
   page reference.
3. **Beat the clock.** The lesson has a **10-minute** timer and each question has a **60-second**
   timer.
4. **Survive ATTACK TIME.** If a question's 60 seconds expire, the question scores as incorrect and
   the opponent *may* call **ATTACK TIME**, subtracting a random **0–60 seconds** from the lesson
   clock. The chance rises from **10% at Level 1 to 90% at Level 9** (10 points per level).
5. **Pass or retake.** A lesson needs **80%** (8 of 10). Anything less keeps the lesson locked with a
   **retake** available — retakes reshuffle the question order and reset both clocks.

Progress is saved in the browser on that device. It does not sync between browsers or computers.

## The final exam

After all twenty-seven lessons, the only attacker left is **SHADOW CAT**: her own shadow.

- **156 questions**, drawn from all twenty-seven lessons (5–6 from each).
- **150 minutes** for the whole exam, with a single total clock.
- **No artificial attacks** — SHADOW CAT never touches the clock.
- **80% to pass.**

Afterward the game reports the score and grade, a **weak-area breakdown by level**, links back to the
lessons that need review, and a **full answer review of all 156 questions** with explanations and
manual/PDF page references.

Passing the exam completes the journey and unlocks the ending: the mother who drives the red car
brings CAT home, she becomes the cardboard box tower queen — and only after that does a small black
cat named BAT come into the story at all.

## TODO

The roadmap for the next round of work. Nothing here is started yet; items marked *(blocked)* wait
on an outside input.

### Art

- [ ] **CAT portrait** — replace `assets/cat.svg` with the generated CAT art. **Keep the same
      filename**: the landing hero, brand mark, favicon, map marker, and ending all reference it, so
      a drop-in file needs no code changes. If the new art is a PNG (likely for generated images),
      name it `cat.png` and say so — the handful of references get updated to match.
- [ ] **SHADOW CAT portrait** — replace `assets/shadow.svg` with the generated SHADOW CAT art, same
      drop-in rule (`shadow.png` likewise gets the references updated).
- [ ] **Ending illustration** *(optional)* — the red car, the mother, and the cardboard box tower for
      the `CAT FINDS A HOME` screen.
- [ ] **Map art upgrade** *(optional)* — hand-painted or generated replacement for `assets/world.svg`
      (the painted road and the 27 stone positions in `app.js` `mapPoints` must stay in step).
- [ ] **Level landmarks** *(optional)* — one small icon per land (barn, windmill, pond, gate…) painted
      on the map.

### Story

- [ ] Per-level story vignettes: a short scene between levels as CAT travels (the scrap bowl, the
      first winter, the night she sees the red car).
- [ ] An ending variation keyed to the exam score (e.g. honors text for 95%+).
- [ ] A “story so far” recap when resuming with more than half the lessons done.
- [ ] Extend the bank with **Pre-Study Guide** topics if that PDF is ever supplied *(blocked)*.

### Gameplay (keep it hard, make it clearer)

- [ ] Keyboard shortcuts: `1–4` to choose an answer, `Enter` to check, `Esc` to leave a quiz.
- [ ] An explicit **resume lesson** affordance on the map (the saved run of an unfinished lesson).
- [ ] Store the **exam review** so it survives a reload (currently it lives only in the results view).
- [ ] A **printable results summary** (exam score, weak areas, citations).
- [ ] Optional **sound cues** for ATTACK TIME and mastery, silenced under `prefers-reduced-motion`.
- [ ] Streak scoring *(optional)*: a small mastery bonus for finishing a lesson with the lesson clock
      above a threshold — keeps the timers meaningful without new pass rules.

### Accessibility & polish

- [ ] `aria-live` announcements for the two countdown clocks and ATTACK TIME.
- [ ] Focus outlines audit across the map stones, chips, and dialog.
- [ ] Small-screen tap-target audit for the map stones (the land chips below the map are the
      comfortable path today).
- [ ] Dark-mode contrast audit of the parchment map card.

### Infrastructure

- [ ] Nothing required — the game is static, dependency-free, and deploys to GitHub Pages on push.
- [ ] Optional: a tiny CI job that runs `tools/build.py` + both suites on every push.

## Run locally

The game lives online at <https://BranamOps.github.io/CAT/> — no install, no launcher, nothing to run.
For local development, serve the folder over HTTP (the game fetches its lesson and question data, so
`file://` will not work). Any static server is fine:

```bash
python3 -m http.server 4174
```

## Project files

- `index.html`, `app.css`, `app.js` — page shell, night-alley theme, and game behavior.
- `data/curriculum.json` — the nine levels, twenty-seven lessons, teaching text, source notes, timer
  configuration, ATTACK TIME curve, and the exam blueprint.
- `data/questions.json` — the 270-question bank.
- `assets/world.svg` — the illustrated journey map (a winding trail to the red car).
- `assets/cat.svg`, `assets/shadow.svg` — character art for CAT and SHADOW CAT.
- `assets/Norris Property and Casualty Training Manual Book 2.pdf` — the source manual.
- `tools/` — the authoring and verification scripts (development only; not needed to play).
- `.github/workflows/static.yml` — deploys the repository to GitHub Pages on every push to `main`.
- `HANDOFF.md` — project status for the next developer or AI session: what is finished, what is
  blocked, how to verify, and the invariants that must not be broken.

## Rebuilding the question bank

The questions are authored as compact data and assembled into JSON, which keeps the answer key
balanced and the citations consistent:

```bash
python3 tools/build.py          # rebuild data/*.json and validate the bank
```

`build.py` refuses to write output unless the bank passes its checks: nine levels, three lessons per
level, ten questions per lesson, four distinct options, a valid answer index, a non-empty explanation,
a manual **and** PDF page reference on every question, an answer key within 15–35% per position, and an
average question difficulty that rises strictly from level to level.

## Verification

```bash
# data + headless DOM behaviour (99 checks)
JSDOM_PATH=/path/to/jsdom node tools/verify.cjs

# real-browser layout, mobile viewport, timers, ATTACK TIME (31 checks)
PLAYWRIGHT_PATH=/path/to/playwright node tools/browser-check.cjs
```

`verify.cjs` drives the actual app in a headless DOM: it starts lessons, lets the question clock
expire, forces and suppresses ATTACK TIME, checks that an attack subtracts exactly the stolen seconds,
runs a full lesson to a passing and a failing score, exercises the retake path, and runs the 156-question
exam to both a passing and a failing result.

`browser-check.cjs` runs the same app in headless Chromium at a 390×844 phone viewport and a 1366×900
desktop viewport, checking for console errors, horizontal overflow, tap-target size, live countdown
behavior, and screenshots of the landing page, map, quiz, ATTACK TIME banner, results and exam.

## Publishing

The repository has no dependencies and no build step: it is plain HTML, CSS, and JavaScript. It runs
from a static server and publishes to GitHub Pages through `.github/workflows/static.yml`.

### First publish (repository does not exist yet)

If `BranamOps/CAT` has not been created, create it once and push this folder to it:

```bash
git init -b main
git add .
git status --short            # review what will be committed
git commit -m "CAT's Insurance Journey"
gh repo create BranamOps/CAT --public --source=. --push
git remote add origin https://github.com/BranamOps/CAT.git   # only if the remote is missing
git push -u origin main
```

`gh auth status` should show an account that can create repositories in the `BranamOps` organisation
or user account. Without that permission, create the repository in the GitHub web UI, then use the
`git remote add` / `git push` lines above.

### Enable Pages (once)

In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow
in `.github/workflows/static.yml` then deploys on every push to `main`. If Pages is left on the
"Deploy from a branch" setting, the action still runs, but the site URL follows the branch setting.

### Every publish after that

```bash
git add .
git status --short     # review what will be committed
git commit -m "Describe the change"
git push origin main
```

Then check the repository's **Actions** tab for a successful Pages deployment and reload
<https://BranamOps.github.io/CAT/>. A deployment can take a few minutes; hard-refresh if the old
version is cached.

### Publish somewhere other than GitHub Pages

Because the whole game is static, any static host works — Netlify, Cloudflare Pages, Vercel, or an
internal web server. Upload the folder as-is; there is nothing to build. The only requirement is that
server-side directory listing is *not* needed and that `index.html` is served for `/`.
