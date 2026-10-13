# CAT's Insurance Journey

A browser-based Property & Casualty learning adventure for Kansas, and a **harder sequel** to
[BAT's Insurance Adventure](https://github.com/BranamOps/BAT). CAT is the stray cat from BAT's story:
she found the Box Tower first, and now she walks nine levels of increasingly difficult — but entirely
harmless — intellectual battles, ending with a final exam against her own shadow.

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
| 2 | The Warm Doorstep | The Porch Keeper | 20% |
| 3 | The Garden Path | The Garden Snake | 30% |
| 4 | The Sunny Wall | The Wall Cat | 40% |
| 5 | The Rooftop Run | The Rooftop Crow | 50% |
| 6 | The Outer Yards | The Yard Dog | 60% |
| 7 | The Night Watch | The Night Rat | 70% |
| 8 | The Highway Verge | The Highway Magpie | 80% |
| 9 | The Long Shadow | The Long Shadow | 90% |

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

After all twenty-seven lessons, CAT meets the last opponent: her own shadow.

- **156 questions**, drawn from all twenty-seven lessons (5–6 from each).
- **150 minutes** for the whole exam, with a single total clock.
- **No artificial attacks** — the shadow never touches the clock.
- **80% to pass.**

Afterward the game reports the score and grade, a **weak-area breakdown by level**, links back to the
lessons that need review, and a **full answer review of all 156 questions** with explanations and
manual/PDF page references.

Passing the exam completes the journey and unlocks the ending, in which CAT finds a loving home.

## Run locally

On Windows, double-click **START CAT Adventure.cmd**. It starts a temporary local web server and opens
the game in the browser. Keep the server window open while playing; close it when finished. Python 3
is required.

Do **not** open `index.html` directly from File Explorer (`file://`): the game fetches its lesson and
question data, so it must be served over HTTP. Any static server works, for example:

```bash
python3 -m http.server 4174
```

## Project files

- `index.html`, `app.css`, `app.js` — page shell, night-alley theme, and game behavior.
- `data/curriculum.json` — the nine levels, twenty-seven lessons, teaching text, source notes, timer
  configuration, ATTACK TIME curve, and the exam blueprint.
- `data/questions.json` — the 270-question bank.
- `assets/cat.svg`, `assets/shadow.svg` — original character art for CAT and her shadow.
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
