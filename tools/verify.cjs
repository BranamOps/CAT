#!/usr/bin/env node
/* Verification for CAT. Checks the authored data and then drives the real app
 * inside a headless DOM so timers, strikes, scoring, retakes and the final
 * exam are exercised through the same interface a learner uses.
 *
 *   JSDOM_PATH=/path/to/jsdom node tools/verify.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const jsdomPath = process.env.JSDOM_PATH || 'jsdom';
const { JSDOM, VirtualConsole } = require(jsdomPath);

const root = path.resolve(__dirname, '..');
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
let checks = 0;
function ok(cond, label, detail) {
  checks += 1;
  if (cond) console.log(`  PASS  ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ' -> ' + detail : ''}`);
  }
}

async function waitFor(fn, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(20);
  }
  return false;
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const STORAGE_KEY = 'cats-insurance-journey-v2';
const MML = /^\d+:\d{2}$/;

async function makeDom(overrides, seed) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/CAT/',
    virtualConsole: vc,
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.__CAT_TEST__ = overrides || {};
  if (seed) w.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  w.fetch = async (u) => {
    const file = path.join(root, 'data', String(u).split('/').pop());
    const text = fs.readFileSync(file, 'utf8');
    return { ok: true, json: async () => JSON.parse(text) };
  };
  const script = w.document.createElement('script');
  script.textContent = appSrc;
  w.document.body.appendChild(script);
  const ready = await waitFor(() => w.__CAT__ && w.__CAT__.bank && w.__CAT__.bank.length > 0);
  if (!ready) throw new Error('app did not finish booting');
  return { dom, w };
}

/* picks an answer then advances exactly one question */
function answerCurrent(w, mode) {
  const run = w.__CAT__.run;
  const q = run.questions[run.index];
  const pick = mode === 'wrong' ? (q.answer + 1) % 4 : q.answer;
  const choice = w.document.querySelector(`[data-choice="${pick}"]`);
  if (!choice) throw new Error('choice button missing');
  choice.click();
  w.document.querySelector('#answerButton').click();
  w.document.querySelector('#answerButton').click();
}

function answerWholeLesson(w, mode) {
  for (let i = 0; i < 10; i += 1) answerCurrent(w, mode);
}

function completeSeed(lessons) {
  return { completed: lessons.map((l) => l.id), attempts: {}, examComplete: false, examBest: null };
}

async function main() {
  /* ---------- 1. authored data ---------- */
  console.log('\n1. Authored data');
  const curriculum = readJSON('data/curriculum.json');
  const bank = readJSON('data/questions.json');
  const lessons = curriculum.levels.flatMap((lv) => lv.lessons);

  ok(curriculum.levels.length === 9, 'nine levels');
  ok(curriculum.levels.every((lv) => lv.lessons.length === 3), 'three lessons per level');
  ok(lessons.length === 27, 'twenty-seven lessons');
  ok(bank.length === 270, 'two hundred seventy questions');
  ok(lessons.every((l) => l.questionIds.length === 10), 'ten questions per lesson');
  ok(new Set(bank.map((q) => q.id)).size === bank.length, 'question ids are unique');
  ok(bank.every((q) => q.options.length === 4 && new Set(q.options).size === 4), 'every question has four distinct options');
  ok(bank.every((q) => q.topic && q.topic.length > 3), 'every question names the concept it tests');
  ok(!/manual p|pdf p|training manual|pre-study guide/i.test(JSON.stringify([curriculum, bank])),
    'no content references a source document');
  ok(bank.every((q) => q.explanation && q.explanation.length > 30), 'every question has a teaching explanation');
  const dist = [0, 0, 0, 0];
  bank.forEach((q) => { dist[q.answer] += 1; });
  ok(dist.map((n) => n / bank.length).every((s) => s >= 0.15 && s <= 0.35), 'answer key is balanced', dist.join('/'));
  ok(curriculum.exam.questionCount === 156 && curriculum.exam.minutes === 150, 'final exam is 156 questions in 150 minutes');
  ok(curriculum.exam.noAttacks === true, 'final exam declares no artificial attacks');
  ok(curriculum.attackTime.baseChancePercent === 10 && curriculum.attackTime.chancePerLevelPercent === 10,
    'attack chance rises 10 points per level');
  ok(curriculum.masteryThreshold === 80 && curriculum.questionsPerLesson === 10, '80% pass on 10 questions');

  const byId = new Map(bank.map((q) => [q.id, q]));
  const levelDiffs = curriculum.levels.map((lv) => lv.lessons
    .flatMap((l) => l.questionIds).map((id) => byId.get(id).difficulty));
  const levelMeans = levelDiffs.map((ds) => ds.reduce((a, b) => a + b, 0) / ds.length);
  ok(levelMeans.every((m, i) => i === 0 || levelMeans[i - 1] < m),
    'average question difficulty increases with every level', levelMeans.map((m) => m.toFixed(2)).join(' '));
  ok(Math.max(...levelDiffs[0]) <= 3, 'level 1 stays accessible', String(Math.max(...levelDiffs[0])));
  ok(Math.max(...levelDiffs[8]) === 5, 'level 9 reaches the hardest questions');
  ok(levelMeans[8] - levelMeans[0] >= 2, 'the difficulty span across the journey is substantial',
    (levelMeans[8] - levelMeans[0]).toFixed(2));

  /* ---------- 2. runtime boot ---------- */
  console.log('\n2. Runtime boot (headless DOM)');
  {
    const { w } = await makeDom();
    ok(w.__CAT__.bank.length === 270, 'app loaded 270 questions');
    ok(w.__CAT__.curriculum.levels.length === 9, 'app loaded 9 levels');
    ok(/0 \/ 27 lessons/.test(w.document.querySelector('#topProgress').textContent), 'progress chip starts at 0 / 27');
    const story = w.document.querySelector('#app').textContent;
    ok(/CAT's Insurance Journey/.test(story), 'landing/story renders');
    ok(/assets\/world\.svg/.test(w.document.querySelector('#app').innerHTML), 'the landing embeds the journey map');
    ok(/own shadow/.test(story), 'the bio hints at the shadow at the end');
    ok(!/How a lesson runs/.test(story), 'the landing drops the how-a-lesson-runs tutorial');
    ok(!/ATTACK TIME/.test(story), 'the landing drops the ATTACK TIME tutorial');
    ok(!/at the end of Level Nine/.test(story), 'the landing drops the shadow explanation');
    ok(!/Manual|PDF p|Norris/i.test(story), 'the landing never references a document');
    ok(/assets\/CAT_young\.jpg/.test(w.document.querySelector('#app').innerHTML), 'landing shows the young CAT art');
    ok(/assets\/MOTHER\.jpg/.test(w.document.querySelector('#app').innerHTML), 'landing shows the goal art');
    ok(w.__CAT__.isGrownUp() === false, 'CAT starts the journey young');

    // the level's difficulty band is shown on the lesson page
    w.__CAT__.renderLesson(1);
    ok(/difficulty band: 1-2 of 5/i.test(w.document.querySelector('#app').textContent),
      'lesson page states the level difficulty band');

    // default clocks, read synchronously right after the run starts
    w.__CAT__.startLessonQuiz(w.__CAT__.curriculum.levels[0].lessons[0]);
    ok(w.document.querySelector('#lessonClock').textContent === '10:00', '10-minute lesson clock by default');
    ok(w.document.querySelector('#questionClock').textContent === '1:00', '60-second per-question clock by default');
    ok(/Difficulty \d\/5/.test(w.document.querySelector('.question-meta').textContent),
      'quiz names the question difficulty');
  }

  /* ---------- 3. attack chance curve ---------- */
  console.log('\n3. ATTACK TIME chance curve');
  {
    const { w } = await makeDom();
    ok(Math.abs(w.__CAT__.attackChance(1) - 0.10) < 1e-9, 'level 1 chance is 10%');
    ok(Math.abs(w.__CAT__.attackChance(5) - 0.50) < 1e-9, 'level 5 chance is 50%');
    ok(Math.abs(w.__CAT__.attackChance(9) - 0.90) < 1e-9, 'level 9 chance is 90%');
  }

  /* ---------- 4. exam blueprint ---------- */
  console.log('\n4. Final exam selection');
  {
    const { w } = await makeDom();
    const mined = w.__CAT__.buildExamQuestions();
    ok(mined.length === 156, 'exam draws exactly 156 questions');
    ok(new Set(mined.map((q) => q.id)).size === 156, 'exam questions are distinct');
    const byLesson = new Map();
    mined.forEach((q) => byLesson.set(q.lessonId, (byLesson.get(q.lessonId) || 0) + 1));
    ok(byLesson.size === 27, 'exam covers all 27 lessons');
    ok(lessons.every((l, i) => byLesson.get(l.id) === curriculum.exam.lessonCounts[i]),
      'exam follows the authored blueprint per lesson');
  }

  /* ---------- 5. lesson timer, timeout and ATTACK TIME ---------- */
  console.log('\n5. Lesson timer, timeout, ATTACK TIME (forced hit)');
  {
    const { w } = await makeDom({ questionTimerSeconds: 1, lessonTimerSeconds: 300, attackChanceForced: 1 });
    w.__CAT__.startLessonQuiz(w.__CAT__.curriculum.levels[0].lessons[0]);
    const before = w.__CAT__.run.lessonDeadline;
    ok(MML.test(w.document.querySelector('#lessonClock').textContent)
      && MML.test(w.document.querySelector('#questionClock').textContent),
      'both clocks render in m:ss');
    const fired = await waitFor(() => w.__CAT__.run.answers.length === 1, 4000);
    ok(fired, 'the per-question clock expires and records the question');
    const a = w.__CAT__.run.answers[0];
    ok(a && a.timedOut === true, 'expired question is recorded as a timeout');
    ok(a && a.correct === false, 'expired question scores as incorrect');
    ok(w.__CAT__.run.attacks.length === 1, 'opponent triggered ATTACK TIME on a forced roll');
    const stolen = w.__CAT__.run.attacks[0].stolen;
    ok(stolen >= 1 && stolen <= 60, 'a strike takes between 1 and 60 seconds', String(stolen));
    ok(w.__CAT__.run.lessonDeadline === before - stolen * 1000, 'attack reduced the remaining lesson time by the stolen amount');
    const banner = w.document.querySelector('#attackBanner');
    ok(banner.classList.contains('show') && /SHADOW CAT STRIKES/.test(banner.textContent), 'the SHADOW CAT strike banner is shown');
    const fb = w.document.querySelector('#feedbackSlot').textContent;
    ok(/Time expired/.test(fb), 'feedback marks the question as timed out');
    ok(/Topic:/.test(fb), 'feedback names the question topic');
    ok(!/Manual|PDF p/.test(fb), 'feedback never cites a document');
  }

  /* ---------- 6. no attack when the roll misses ---------- */
  console.log('\n6. ATTACK TIME suppressed when the roll misses');
  {
    const { w } = await makeDom({ questionTimerSeconds: 1, lessonTimerSeconds: 300, attackChanceForced: 0 });
    w.__CAT__.startLessonQuiz(w.__CAT__.curriculum.levels[8].lessons[2]);
    const before = w.__CAT__.run.lessonDeadline;
    await waitFor(() => w.__CAT__.run.answers.length === 1, 4000);
    ok(w.__CAT__.run.attacks.length === 0, 'no attack recorded when the roll misses');
    ok(w.__CAT__.run.lessonDeadline === before, 'lesson clock untouched when the roll misses');
    ok(/holds back/i.test(w.document.querySelector('#attackBanner').textContent), 'banner explains that SHADOW CAT held back');
  }

  /* ---------- 7. scoring, pass and progression ---------- */
  console.log('\n7. Scoring, passing and unlocking');
  {
    const { w } = await makeDom();
    w.__CAT__.startLessonQuiz(w.__CAT__.curriculum.levels[0].lessons[0]);
    answerWholeLesson(w, 'correct');
    const results = w.document.querySelector('#app').textContent;
    ok(/Lesson mastered/.test(results), 'a perfect run masters the lesson');
    ok(/100%/.test(results), 'perfect run shows 100%');
    ok(w.__CAT__.progress.completed.includes(1), 'lesson 1 is saved as complete');
    ok(w.__CAT__.progress.attempts[1] === 1, 'attempt count incremented');
    ok(w.document.querySelectorAll('.answer-row').length === 10, 'answer review lists all ten questions');
    ok(/"completed":\[1\]/.test(w.localStorage.getItem(STORAGE_KEY)), 'progress persists to localStorage');
    ok(!!w.document.querySelector('#nextStop'), 'passing offers the next stop');
  }

  /* ---------- 8. failing and retaking ---------- */
  console.log('\n8. Failing, retake flow');
  {
    const { w } = await makeDom({}, { completed: [1], attempts: { 1: 1 }, examComplete: false, examBest: null });
    w.__CAT__.startLessonQuiz(w.__CAT__.curriculum.levels[0].lessons[1]);
    answerWholeLesson(w, 'wrong');
    const results = w.document.querySelector('#app').textContent;
    ok(/Keep practicing/.test(results), 'a failed run is not marked mastered');
    ok(/0%/.test(results), 'all-wrong run scores 0%');
    ok(!w.__CAT__.progress.completed.includes(2), 'failed lesson is not saved as complete');
    ok(!!w.document.querySelector('#retake'), 'a retake control is offered');
    w.document.querySelector('#retake').click();
    ok(/Check your understanding/.test(w.document.querySelector('#app').textContent), 'retake returns to the lesson');
    w.document.querySelector('#startQuiz').click();
    ok(w.__CAT__.run && w.__CAT__.run.questions.length === 10, 'retake starts a fresh ten-question run');
    answerWholeLesson(w, 'correct');
    ok(/Lesson mastered/.test(w.document.querySelector('#app').textContent), 'retake can pass on the second attempt');
    ok(w.__CAT__.progress.attempts[2] === 2, 'both attempts are recorded');
  }

  /* ---------- 9. lesson clock running out ---------- */
  console.log('\n9. Lesson clock running out');
  {
    const { w } = await makeDom({ lessonTimerSeconds: 1, questionTimerSeconds: 30, attackChanceForced: 0 });
    w.__CAT__.startLessonQuiz(w.__CAT__.curriculum.levels[0].lessons[0]);
    ok(await waitFor(() => w.__CAT__.run.ended === true, 4000), 'lesson ends when the lesson clock reaches zero');
    ok(/clock ran out/.test(w.document.querySelector('#app').textContent), 'results explain that the clock ran out');
    ok(!w.__CAT__.progress.completed.includes(1), 'a timed-out lesson does not unlock the next stop');
  }

  /* ---------- 10. final exam: 156 questions, no attacks, passing ---------- */
  console.log('\n10. Final exam (156 questions, no ATTACK TIME) - passing run');
  {
    const { w } = await makeDom({}, completeSeed(lessons));
    w.__CAT__.renderExamIntro();
    const intro = w.document.querySelector('#app').textContent;
    ok(/The Shadow at the End of Level Nine/.test(intro), 'shadow intro renders');
    ok(/assets\/SHADOW-1\.jpg/.test(w.document.querySelector('#app').innerHTML), 'SHADOW-1 art renders');
    w.document.querySelector('#beginExam').click();
    const run = w.__CAT__.run;
    ok(run.kind === 'exam', 'exam mode starts');
    ok(run.questions.length === 156, 'exam run holds 156 questions');
    ok(run.attacks.length === 0, 'no attacks in the exam');
    ok(!!w.document.querySelector('#examClockLarge'), 'exam shows a single total clock');
    ok(!w.document.querySelector('#questionClock'), 'exam has no per-question clock');
    ok(/None/.test(w.document.querySelector('.timer-strip').textContent), 'exam timer strip states attacks: none');

    for (let i = 0; i < 155; i += 1) {
      run.answers.push({ question: run.questions[i], selected: run.questions[i].answer, correct: true, timedOut: false });
    }
    run.index = 155;
    answerCurrent(w, 'correct'); // 156th answered through the UI
    const res = w.document.querySelector('#app').textContent;
    ok(w.document.querySelectorAll('.answer-row').length === 156, 'results review lists all 156 questions');
    ok(/Weak-area feedback/.test(res), 'results include weak-area feedback');
    ok(w.document.querySelectorAll('.weak-card').length === 9, 'weak-area feedback covers every level');
    ok(!/Manual p|PDF p/i.test(res), 'results never cite a document');
    ok(/%$|%/.test(res), 'results show a percentage');
    ok(w.__CAT__.progress.examComplete === true, 'a passing exam marks the journey complete');
    ok(!!w.document.querySelector('#seeEnding'), 'a passing result offers the ending');
    w.document.querySelector('#seeEnding').click();
    const ending = w.document.querySelector('#app').textContent;
    ok(/CAT FINDS A HOME/.test(ending), 'the ending renders the loving home');
    ok(/assets\/(CAT_young|CAT_older)\.jpg/.test(w.document.querySelector('#app').innerHTML), 'the ending shows CAT art');
    ok(/assets\/MOTHER\.jpg/.test(w.document.querySelector('#app').innerHTML), 'the ending shows the goal art');
  }

  /* ---------- 11. exam failure path ---------- */
  console.log('\n11. Final exam - failing run offers a retake and names weak areas');
  {
    const { w } = await makeDom({}, completeSeed(lessons));
    w.__CAT__.renderExamIntro();
    w.document.querySelector('#beginExam').click();
    const run = w.__CAT__.run;
    for (let i = 0; i < 155; i += 1) {
      const correct = i % 3 === 0; // only a third correct
      run.answers.push({ question: run.questions[i], selected: run.questions[i].answer, correct, timedOut: false });
    }
    run.index = 155;
    answerCurrent(w, 'wrong');
    const res = w.document.querySelector('#app').textContent;
    ok(!!w.document.querySelector('#retryExam'), 'a failing exam offers a retake');
    ok(w.__CAT__.progress.examComplete === false, 'a failing exam does not complete the journey');
    ok(/Levels below the 80% mark/.test(res), 'weak levels are named explicitly');
    ok(/Study these lessons again/.test(res), 'weak areas link back to lessons');
  }

  /* ---------- 12. exam clock expiry has no attacks ---------- */
  console.log('\n12. Exam clock expiry');
  {
    const { w } = await makeDom({}, completeSeed(lessons));
    w.__CAT__.renderExamIntro();
    w.document.querySelector('#beginExam').click();
    w.__CAT__.run.examDeadline = Date.now() - 10;
    ok(await waitFor(() => w.__CAT__.run.ended === true, 3000), 'exam ends when the 150-minute clock expires');
    ok(/clock ran out/.test(w.document.querySelector('#app').textContent), 'exam expiry is explained');
    ok(w.__CAT__.run.attacks.length === 0, 'exam expiry involved no artificial attacks');
  }

  /* ---------- 13. map and gating ---------- */
  console.log('\n13. Journey map and gating');
  {
    const { w } = await makeDom({}, completeSeed(lessons));
    w.__CAT__.renderMap();
    const map = w.document.querySelector('#app').textContent;
    ok(/27 lessons/.test(map) || /27/.test(map), 'map shows the 27-lesson progress');
    ok(w.document.querySelectorAll('.stop').length === 27, 'map renders 27 lesson stops');
    ok(w.document.querySelectorAll('.stop.completed').length === 27, 'all stops show as mastered');
    ok(w.document.querySelectorAll('.level-band').length === 9, 'map renders 9 level bands');
    w.document.querySelector('#continueButton').click();
    ok(/The Shadow at the End of Level Nine/.test(w.document.querySelector('#app').textContent),
      'a completed map leads to the shadow');

    // locked lesson cannot be opened on a fresh profile
    const { w: fresh } = await makeDom();
    fresh.__CAT__.renderMap();
    const locked = fresh.document.querySelectorAll('.stop[disabled]');
    ok(locked.length === 26, 'twenty-six lessons start locked');
    fresh.__CAT__.renderLesson(5);
    ok(/Check your understanding|Journey map|CAT's road/.test(fresh.document.querySelector('#app').textContent),
      'opening a locked lesson is refused');
  }

  /* ---------- 14. static hosting requirements ---------- */
  console.log('\n14. Static hosting and mobile requirements');
  {
    const files = ['index.html', 'app.css', 'app.js', 'data/curriculum.json', 'data/questions.json',
      'assets/CAT_young.jpg', 'assets/CAT_older.jpg', 'assets/contestant-1.jpg', 'assets/SHADOW-1.jpg',
      'assets/MOTHER.jpg', 'assets/world.svg', '.github/workflows/static.yml'];
    const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
    ok(missing.length === 0, 'all deployable files exist', missing.join(', '));
    const shipped = fs.readdirSync(path.join(root, 'assets'));
    const allowed = ['CAT_young.jpg', 'CAT_older.jpg', 'contestant-1.jpg', 'SHADOW-1.jpg', 'MOTHER.jpg', 'world.svg'];
    ok(shipped.length === allowed.length && allowed.every((f) => shipped.includes(f)),
      'assets contain only the game artwork', shipped.join(', '));
    ok(/<meta name="viewport"/.test(html), 'viewport meta tag present for mobile layout');
    const css = fs.readFileSync(path.join(root, 'app.css'), 'utf8');
    ok((css.match(/@media/g) || []).length >= 2, 'stylesheet declares responsive breakpoints');
    ok(/@media \(max-width: 560px\)/.test(css), 'a small-screen breakpoint exists');
    ok(/prefers-reduced-motion/.test(css), 'respects prefers-reduced-motion');
    ok(!/http:\/\/(?!www\.w3\.org)/.test(html + css), 'no external runtime dependencies in html/css');
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/static.yml'), 'utf8');
    ok(/actions\/deploy-pages/.test(workflow), 'Pages deploy workflow present');
  }

  /* ---------- 15. CAT art, contests, keyboard and the saved review ---------- */
  console.log('\n15. CAT art, contests, keyboard and the saved exam review');
  {
    const { w } = await makeDom();
    ok(/assets\/CAT_young\.jpg/.test(w.document.querySelector('#app').innerHTML), 'the landing shows the young CAT art');
    ok(/assets\/MOTHER\.jpg/.test(w.document.querySelector('#app').innerHTML), 'the landing shows the goal art');
    ok(w.__CAT__.isGrownUp() === false, 'CAT starts the journey young');

    const halfway = completeSeed(lessons.slice(0, 13));
    const { w: mid } = await makeDom({}, halfway);
    ok(mid.__CAT__.isGrownUp() === false, 'still young at 13 of 27 lessons');
    mid.__CAT__.progress.completed.push(14);
    ok(mid.__CAT__.isGrownUp() === true, 'fully grown once lesson 14 is mastered');

    const { w: grown } = await makeDom({}, completeSeed(lessons));
    grown.__CAT__.renderMap();
    ok(/assets\/CAT_older\.jpg/.test(grown.document.querySelector('#app').innerHTML), 'the map marker uses the older CAT art');

    const { w: battle } = await makeDom({ questionTimerSeconds: 1, lessonTimerSeconds: 300, attackChanceForced: 1 });
    battle.__CAT__.startLessonQuiz(battle.__CAT__.curriculum.levels[3].lessons[0]);
    ok(/assets\/contestant-1\.jpg/.test(battle.document.querySelector('#app').innerHTML), 'the contestant appears during a battle');
    await waitFor(() => battle.__CAT__.run.attacks.length === 1, 4000);
    ok(/SHADOW CAT STRIKES/.test(battle.document.querySelector('#attackBanner').innerHTML), 'the strike banner names SHADOW CAT');

    const { w: kb } = await makeDom();
    kb.__CAT__.startLessonQuiz(kb.__CAT__.curriculum.levels[0].lessons[0]);
    kb.document.dispatchEvent(new kb.window.KeyboardEvent('keydown', { key: '2', bubbles: true }));
    ok(kb.__CAT__.run.selected === 1, 'pressing 2 selects the second choice');
    kb.document.dispatchEvent(new kb.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    ok(kb.__CAT__.run.answers.length === 1, 'Enter checks the answer');
    ok(kb.__CAT__.run.answers[0].selected === 1, 'the keyboard-selected choice is the one graded');
    kb.document.dispatchEvent(new kb.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok(/Check your understanding/.test(kb.document.querySelector('#app').textContent), 'Escape leaves the quiz');

    const { w: t } = await makeDom();
    t.__CAT__.startLessonQuiz(t.__CAT__.curriculum.levels[0].lessons[0]);
    const qt = t.__CAT__.run.questions[0];
    t.document.querySelector(`[data-choice="${qt.answer}"]`).click();
    t.document.querySelector('#answerButton').click();
    ok(/Topic:<\/strong>/.test(t.document.querySelector('#feedbackSlot').innerHTML), 'feedback names the question topic');
    ok(!/Manual|PDF p/.test(t.document.querySelector('#feedbackSlot').innerHTML), 'feedback never cites a document');

    const { w: rev } = await makeDom({}, completeSeed(lessons));
    rev.__CAT__.renderExamIntro();
    rev.document.querySelector('#beginExam').click();
    const r = rev.__CAT__.run;
    for (let i = 0; i < 155; i += 1) r.answers.push({ question: r.questions[i], selected: r.questions[i].answer, correct: true, timedOut: false });
    r.index = 155;
    answerCurrent(rev, 'correct');
    ok(rev.__CAT__.progress.examReview && rev.__CAT__.progress.examReview.rows.length === 156, 'the exam review is stored in progress');
    ok(/"examReview"/.test(rev.localStorage.getItem(STORAGE_KEY)), 'the stored review is written to localStorage');

    const saved = JSON.parse(rev.localStorage.getItem(STORAGE_KEY));
    const { w: reloaded } = await makeDom({}, saved);
    ok(!!reloaded.__CAT__.progress.examReview, 'the saved review loads back after a reload');
    reloaded.__CAT__.renderExamReview();
    ok(reloaded.document.querySelectorAll('.answer-row').length === 156, 'the saved review renders all 156 questions');
  }

  /* ---------- 16. the contestant and the double-speed clocks ---------- */
  console.log('\n16. The contestant and the double-speed clocks');
  {
    const { w } = await makeDom();
    w.__CAT__.startLessonQuiz(w.__CAT__.curriculum.levels[0].lessons[0]);
    const run = w.__CAT__.run;
    ok(w.__CAT__.contestantCries.length === 7, 'there are seven cries', String(w.__CAT__.contestantCries.length));
    ok(!run.contestant.active, 'the contestant is not on screen at the start');

    run.contestant.nextAt = 0;
    ok(await waitFor(() => run.contestant.active, 3000), 'the contestant turns up during the quiz');
    await sleep(150);
    const slot = w.document.querySelector('#contestantSlot');
    ok(slot && !slot.hidden, 'the contestant is shown');
    ok(/assets\/contestant-1\.jpg/.test(slot.innerHTML), 'the contestant art is on screen');
    const choices = w.document.querySelector('#choiceList');
    ok(!!(choices && choices.compareDocumentPosition(slot) & 4), 'the contestant sits below the multiple choice');
    const cry = w.document.querySelector('#contestantBubble').textContent;
    ok(w.__CAT__.contestantCries.includes(cry), 'the bubble shows one of the cries', cry);

    const lessonBefore = run.lessonDeadline - Date.now();
    const questionBefore = run.questionDeadline - Date.now();
    await sleep(1000);
    const lessonBurned = lessonBefore - (run.lessonDeadline - Date.now());
    const questionBurned = questionBefore - (run.questionDeadline - Date.now());
    ok(lessonBurned > 1500, 'the lesson clock runs at double speed', String(Math.round(lessonBurned)));
    ok(questionBurned > 1500, 'the question clock runs at double speed', String(Math.round(questionBurned)));

    run.contestant.until = Date.now() - 1;
    ok(await waitFor(() => !run.contestant.active, 3000), 'the contestant leaves again');
    await sleep(150);
    ok(w.document.querySelector('#contestantSlot').hidden, 'the contestant is hidden once it leaves');

    const { w: ex } = await makeDom({}, completeSeed(lessons));
    ex.__CAT__.renderExamIntro();
    ex.document.querySelector('#beginExam').click();
    ok(!ex.document.querySelector('#contestantSlot'), 'the final exam has no contestant');
  }

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures) {
    console.log(`${failures} FAILED.`);
    process.exit(1);
  }
  console.log('All checks passed.');
  process.exit(0); // jsdom keeps timers alive; exit explicitly
}

main().catch((e) => {
  console.error('verify crashed:', e);
  process.exit(1);
});
