(() => {
  'use strict';

  const app = document.querySelector('#app');
  const topProgress = document.querySelector('#topProgress');
  const storageKey = 'cats-insurance-journey-v2';
  const letters = ['A', 'B', 'C', 'D'];

  /* Character art. CAT begins young and grows up once enough lessons are mastered; contestants
     appear during battles, SHADOW-1 is the final boss, and MOTHER is the goal and the ending. */
  const ART = {
    catYoung: 'assets/CAT_young.jpg',
    catOlder: 'assets/CAT_older.jpg',
    contestant: 'assets/contestant-1.jpg',
    shadow: 'assets/SHADOW-1.jpg',
    mother: 'assets/MOTHER.jpg',
  };

  /* Other cats who test CAT's insurance knowledge, one per level. The battles are intellectual, never harmful. */
  const opponents = {
    1: 'The Alley Tom',
    2: 'The Porch Cat',
    3: 'The Garden Tabby',
    4: 'The Wall Cat',
    5: 'The Rooftop Tom',
    6: 'The Yard Cat',
    7: 'The Night Cat',
    8: 'The Highway Cat',
    9: 'SHADOW CAT',
  };

  /* Twenty-seven trail stones on assets/world.svg, in percent of the map frame, plus the goal:
     the red car. Keep these in step with the painted road in world.svg. */
  const mapPoints = [
    [7, 87], [13, 84], [19, 87], [25, 83], [22, 78], [28, 75], [34, 78], [40, 74], [36, 69],
    [31, 66], [37, 63], [43, 66], [49, 62], [47, 57], [53, 54], [59, 57], [64, 52], [60, 47],
    [55, 44], [61, 41], [67, 44], [72, 39], [70, 34], [76, 31], [81, 28], [86, 31], [90, 25],
  ];
  const goalPoint = [85, 15];

  /* Optional overrides let an automated check run shortened clocks. Never set in normal use. */
  const testOverrides = (typeof window !== 'undefined' && window.__CAT_TEST__) || {};

  let curriculum = null;
  let bank = [];
  let progress = loadProgress();
  let activeRun = null;
  let ticker = null;
  let storySeen = sessionStorage.getItem('cats-intro-seen') === 'yes';
  let testerUnlocked = false;
  let testerPassCount = 0;
  const testing = { skipAnswers: false };

  const CFG = {
    lessonTimerSeconds: () => curr('lessonTimerSeconds', 600),
    questionTimerSeconds: () => curr('questionTimerSeconds', 60),
    masteryThreshold: () => curr('masteryThreshold', 80),
    adultAtLesson: () => curr('adultAtLesson', 14),
  };

  function curr(path, fallback) {
    if (testOverrides[path] != null) return testOverrides[path];
    if (curriculum && curriculum[path] != null) return curriculum[path];
    return fallback;
  }

  /* ---------------- storage ---------------- */

  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        completed: Array.isArray(p.completed)
          ? p.completed.filter((n) => Number.isInteger(n) && n >= 1 && n <= 27)
          : [],
        attempts: p.attempts && typeof p.attempts === 'object' ? p.attempts : {},
        examComplete: p.examComplete === true,
        examBest: p.examBest && typeof p.examBest === 'object' ? p.examBest : null,
        examReview: p.examReview && typeof p.examReview === 'object' ? p.examReview : null,
      };
    } catch (_) {
      return { completed: [], attempts: {}, examComplete: false, examBest: null, examReview: null };
    }
  }

  function saveProgress() {
    localStorage.setItem(storageKey, JSON.stringify(progress));
    updateProgressLabel();
  }

  function updateProgressLabel() {
    topProgress.textContent = `${progress.completed.length} / 27 lessons`;
    const brand = document.querySelector('.brand-mark img');
    if (brand) brand.src = catArt();
  }

  /* CAT grows up halfway through the journey: artwork switches from young to older. */
  function isGrownUp() { return progress.completed.length >= CFG.adultAtLesson(); }
  function catArt() { return isGrownUp() ? ART.catOlder : ART.catYoung; }

  /* ---------------- helpers ---------------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function shuffle(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function lessons() {
    return curriculum.levels.flatMap((lv) => lv.lessons);
  }

  function complete(id) { return progress.completed.includes(id); }
  function unlocked(id) { return id === 1 || complete(id - 1) || testerUnlocked; }
  function nextLesson() { return lessons().find((l) => !complete(l.id)) || null; }
  function levelFor(id) { return curriculum.levels.find((lv) => lv.lessons.some((x) => x.id === id)); }
  function getQuestion(id) { return bank.find((q) => q.id === id); }

  /* Chance the opponent calls ATTACK TIME: 10% at level 1 rising to 90% at level 9. */
  function attackChance(levelId) {
    if (testOverrides.attackChanceForced != null) return testOverrides.attackChanceForced;
    const cfg = curriculum.attackTime;
    const chance = cfg.baseChancePercent + (levelId - 1) * cfg.chancePerLevelPercent;
    return Math.max(0, Math.min(cfg.maxChancePercent || 90, chance)) / 100;
  }

  function stopTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  function navActive(name) {
    document.querySelectorAll('[data-nav]').forEach((b) => {
      b.classList.toggle('active', b.dataset.nav === name);
    });
  }

  function gradeLetter(percent) {
    return percent >= 90 ? 'A' : percent >= 80 ? 'B' : percent >= 70 ? 'C' : percent >= 60 ? 'D' : 'F';
  }

  /* ---------------- landing / story ---------------- */

  function renderStory() {
    stopTicker();
    navActive('story');
    const lv = curriculum.levels;
    const levelCards = lv.map((level) => `
      <div class="level-card" style="--level:${level.color}">
        <span class="lv-num">Level ${level.id}</span>
        <strong>${esc(level.title)}</strong>
        <p>${esc(level.tagline)}</p>
      </div>`).join('');

    app.className = 'view-animate';
    app.innerHTML = `
      <section class="hero">
        <div class="hero-art">
          <img src="${catArt()}" alt="CAT, a stray cat with bright amber eyes." />
        </div>
        <div class="hero-copy">
          <span class="eyebrow">A harder sequel to BAT</span>
          <h1>CAT's Insurance Journey</h1>
          <p class="hero-lede">
            Nine levels. Twenty-seven lessons. At every stop an opponent waits &mdash; not to hurt her,
            only to argue about Kansas Property &amp; Casualty rules. Ten questions per lesson, a
            ten-minute clock, and sixty seconds per question.
          </p>
          <div class="story-actions">
            <button class="button" id="storyBegin">${progress.completed.length ? "Continue CAT's journey" : 'Begin the journey'} &rarr;</button>
            <button class="text-button" id="storyMap">See the journey map first</button>
          </div>
        </div>
      </section>

      <div class="section-heading">
        <div>
          <span class="eyebrow">CAT's story</span>
          <h2>Survival, a red car, and the road out</h2>
        </div>
      </div>
      <section class="content-card story-copy">
        ${curriculum.story.map((p) => `<p>${esc(p)}</p>`).join('')}
      </section>

      <div class="section-heading">
        <div><span class="eyebrow">The goal</span><h2>The door CAT is learning to reach</h2></div>
      </div>
      <section class="goal-band">
        <div class="goal-art"><img src="${ART.mother}" alt="The mother who drives the red car." /></div>
        <div class="goal-copy">
          <p>
            This is what all nine levels lead to: the red car, the mother who drives it, and a house with a
            stack of cardboard boxes that will be CAT's alone. Every lesson below is practice for that one
            ordinary afternoon &mdash; the rules matter, but the ride out is the point.
          </p>
        </div>
      </section>

      <div class="section-heading">
        <div><h2>How a lesson runs</h2><p>Every stop follows the same short loop.</p></div>
      </div>
      <section class="feature-grid">
        <div class="feature-card"><h3>1 &middot; Read</h3><p>A short lesson that teaches one idea at a time, written in plain language.</p></div>
        <div class="feature-card"><h3>2 &middot; Answer 10</h3><p>Ten questions, four choices each. Every answer reveals an explanation and the concept it tests.</p></div>
        <div class="feature-card"><h3>3 &middot; Beat the clock</h3><p>Ten minutes for the whole lesson and sixty seconds per question. Run out of time and the clock itself can be attacked.</p></div>
        <div class="feature-card"><h3>4 &middot; Pass or retake</h3><p>Score 8 of 10 to move on. Anything less and the lesson waits for a retake.</p></div>
      </section>

      <div class="section-heading">
        <div><h2>ATTACK TIME</h2><p>The sequel's signature rule.</p></div>
      </div>
      <section class="rules-grid">
        <div class="rule-card"><h3><span class="big">10%</span>at Level 1</h3><p>When a question's sixty seconds run out, the opponent rolls for ATTACK TIME.</p></div>
        <div class="rule-card"><h3><span class="big">+10%</span>per level</h3><p>The chance climbs steadily, one level at a time, all the way up the map.</p></div>
        <div class="rule-card"><h3><span class="big">90%</span>at Level 9</h3><p>At the top of the journey, a missed question almost always draws a strike.</p></div>
        <div class="rule-card"><h3><span class="big">0&ndash;60s</span>stolen</h3><p>An attack subtracts a random slice of time from the lesson's ten-minute clock.</p></div>
      </section>

      <div class="section-heading">
        <div><h2>The final exam</h2><p>No tricks at the end, only questions.</p></div>
      </div>
      <section class="exam-facts">
        <div class="exam-fact"><b>156</b><span>questions</span></div>
        <div class="exam-fact"><b>150</b><span>minutes</span></div>
        <div class="exam-fact"><b>80%</b><span>to pass</span></div>
        <div class="exam-fact"><b>0</b><span>artificial attacks</span></div>
      </section>
      <section class="content-card">
        <h2>SHADOW CAT at the end of Level Nine</h2>
        <p>
          After the twenty-seventh lesson, the only attacker left is SHADOW CAT: her own shadow. The
          exam draws 156 questions from every lesson, gives 150 minutes, and uses no ATTACK TIME at all.
          It is the one battle where the only clock is the one she carries herself &mdash; and the red
          car is waiting at the end of it. Finish with results, explanations, and a breakdown of the areas
          that need work.
        </p>
      </section>

      <div class="section-heading">
        <div><h2>The nine levels</h2><p>From the backyard in the country to the red car at the edge of town.</p></div>
      </div>
      <section class="levels-grid">${levelCards}</section>

      <div class="cta-band">
        <div>
          <h2>${nextLesson() ? `Next stop: Lesson ${nextLesson().id}` : (progress.examComplete ? 'The journey is complete' : 'SHADOW CAT is waiting')}</h2>
          <p>${progress.completed.length} of 27 lessons mastered. Progress is saved in this browser on this device.</p>
        </div>
        <button class="button" id="storyCta">${progress.completed.length ? 'Continue' : 'Start Lesson 1'} &rarr;</button>
      </div>
      <div class="map-footer-note manual-note">A Kansas Property &amp; Casualty study game &middot; every answer explains the idea it tests.</div>
    `;

    const go = () => {
      storySeen = true;
      sessionStorage.setItem('cats-intro-seen', 'yes');
      const next = nextLesson();
      if (next) renderLesson(next.id);
      else if (progress.examComplete) renderEnding();
      else renderExamIntro();
    };
    document.querySelector('#storyBegin').addEventListener('click', go);
    document.querySelector('#storyCta').addEventListener('click', go);
    document.querySelector('#storyMap').addEventListener('click', () => {
      storySeen = true;
      sessionStorage.setItem('cats-intro-seen', 'yes');
      renderMap();
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- journey map ---------------- */

  function renderMap() {
    stopTicker();
    navActive('map');
    const next = nextLesson();
    const allDone = !next;
    const examReady = allDone && !progress.examComplete;

    const [mx, my] = next ? mapPoints[next.id - 1] : goalPoint;

    /* The 27 lesson stones sit on the map image itself, BAT-style. */
    const nodes = lessons().map((lesson) => {
      const [x, y] = mapPoints[lesson.id - 1];
      const done = complete(lesson.id);
      const open = unlocked(lesson.id);
      const isCurrent = next && next.id === lesson.id;
      const cls = [
        'stop',
        done ? 'completed' : '',
        open && !done ? 'available' : '',
        isCurrent ? 'current' : '',
        !open ? 'locked' : '',
      ].filter(Boolean).join(' ');
      const state = done ? 'Mastered' : open ? (isCurrent ? 'Current stop' : 'Ready') : 'Locked';
      return `<button class="${cls}" data-lesson="${lesson.id}"${open ? '' : ' disabled'}
                style="left:${x}%;top:${y}%"
                title="Lesson ${lesson.id}: ${esc(lesson.title)} - ${state}"
                aria-label="Lesson ${lesson.id}: ${esc(lesson.title)} - ${state}">${done ? '&#10003;' : lesson.id}</button>`;
    }).join('');

    const bands = curriculum.levels.map((level) => {
      const openCount = level.lessons.filter((l) => complete(l.id)).length;
      const chips = level.lessons.map((lesson) => {
        const done = complete(lesson.id);
        const open = unlocked(lesson.id);
        const state = done ? 'Mastered' : open ? 'Ready' : 'Locked';
        return `<button class="band-lesson${done ? ' completed' : ''}" data-lesson="${lesson.id}"${open ? '' : ' disabled'}>
                  <span class="band-num" aria-hidden="true">${done ? '&#10003;' : lesson.id}</span>
                  <span class="band-title">${esc(lesson.title)}</span>
                  <span class="band-state">${state}</span>
                </button>`;
      }).join('');
      return `<section class="level-band" style="--level:${level.color}">
          <div class="level-band-head">
            <div>
              <span class="lv-num">Level ${level.id} &middot; opponent: ${esc(opponents[level.id])}</span>
              <h2>${esc(level.title)}</h2>
              <p class="lv-tag">${esc(level.tagline)}</p>
            </div>
            <span class="lv-open">${openCount} / 3 mastered</span>
          </div>
          <div class="band-lessons">${chips}</div>
        </section>`;
    }).join('');

    app.className = 'view-animate';
    app.innerHTML = `
      <section class="map-intro">
        <div class="map-intro-copy">
          <span class="eyebrow">CAT's road, nine lands long</span>
          <h1>Twenty-seven lessons to the red car.</h1>
          <p>
            Follow the winding trail from the backyard to the road out. Master a lesson to open the
            next stone. Every land is guarded by a cat who will call ATTACK TIME when the clock runs
            out &mdash; more often the farther CAT travels.
          </p>
          <div class="map-controls">
            <button class="button" id="continueButton">
              ${examReady ? 'Face SHADOW CAT &rarr;' : progress.examComplete ? 'Walk the path again &rarr;' : allDone ? 'Meet SHADOW CAT &rarr;' : `${progress.completed.length ? 'Continue the journey' : 'Begin at Lesson 1'} &rarr;`}
            </button>
            <button class="text-button" id="storyAgain">Read CAT's story</button>
            ${progress.examReview ? '<button class="text-button" id="reviewLastExam">Review last exam</button>' : ''}
          </div>
        </div>
        <div class="map-progress-summary">
          <strong>${progress.completed.length}<span>/27</span></strong>
          <small>lessons mastered</small>
        </div>
      </section>
      <section class="map-card" aria-label="Adventure map with twenty-seven lesson destinations">
        <div class="map-frame">
          <img class="map-image" src="assets/world.svg" alt="A winding dotted trail climbs through nine country lands, past twenty-seven lesson stones, to a red car waiting beside a warm lit door." />
          <div class="map-overlay" id="mapOverlay">
            <div class="map-marker" style="left:${mx}%;top:${my}%" aria-label="CAT's current position">
              <img src="${catArt()}" alt="" />
            </div>
            ${nodes}
          </div>
        </div>
        <div class="map-caption">
          <span>Click an open stone to study. Locked stones open as CAT masters the path.</span>
          <div class="map-legend">
            <span class="legend-item"><i class="legend-swab swab-done"></i> Mastered</span>
            <span class="legend-item"><i class="legend-swab swab-current"></i> Current</span>
            <span class="legend-item"><i class="legend-swab swab-locked"></i> Locked</span>
          </div>
        </div>
      </section>
      <div class="journey">${bands}</div>
      <div class="manual-note">
        <strong>Subject:</strong> ${esc(curriculum.subject)}. Lesson notes and every question explain the
        idea being tested &mdash; no page-hunting required.
      </div>
    `;

    document.querySelectorAll('[data-lesson]').forEach((btn) => {
      btn.addEventListener('click', () => renderLesson(Number(btn.dataset.lesson)));
    });
    document.querySelector('#continueButton').addEventListener('click', () => {
      if (testerUnlocked) { renderExamIntro(); return; }
      if (allDone) { progress.examComplete ? renderEnding() : renderExamIntro(); return; }
      renderLesson(next.id);
    });
    document.querySelector('#storyAgain').addEventListener('click', renderStory);
    const reviewBtn = document.querySelector('#reviewLastExam');
    if (reviewBtn) reviewBtn.addEventListener('click', renderExamReview);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- study guide ---------------- */

  function renderManual(selectedId = null) {
    stopTicker();
    navActive('manual');
    const all = lessons();
    const selected = all.find((l) => l.id === selectedId) || null;

    const nav = curriculum.levels.map((level) => `
      <section class="study-map-level" style="--level:${level.color}">
        <h2>Level ${level.id} &middot; ${esc(level.title)}</h2>
        ${level.lessons.map((l) => `
          <button class="study-map-link ${selected && selected.id === l.id ? 'active' : ''}" data-study-lesson="${l.id}">
            <span>Lesson ${l.id}</span>${esc(l.title)}
          </button>`).join('')}
      </section>`).join('');

    const content = selected ? `
      <div class="lesson-kicker">Lesson ${selected.id} &middot; Level ${levelFor(selected.id).id}</div>
      <h2>${esc(selected.title)}</h2>
      <p class="study-subtitle">${esc(selected.subtitle)}</p>
      ${selected.teaching.map((t) => `
        <section class="study-topic"><h3>${esc(t.heading)}</h3><p>${esc(t.text)}</p></section>`).join('')}
      <p class="study-citation">Study focus: ${esc(selected.title)}.</p>
    ` : `<div class="empty-state"><h2>Pick a lesson to study</h2><p>Each outline summarizes the knowledge covered in that lesson's quiz.</p></div>`;

    app.className = 'view-animate';
    app.innerHTML = `
      <button class="back-link" id="manualBack">&larr; Journey map</button>
      <div class="lesson-top">
        <span class="lesson-kicker">Study map &middot; no quiz answers</span>
        <h1>The study guide, in plain language</h1>
        <p>Choose a lesson for a concise outline of the ideas to understand. These notes explain the subject matter without revealing quiz answers.</p>
      </div>
      <div class="study-map-layout">
        <nav class="study-map-nav" aria-label="Study guide lessons">${nav}</nav>
        <article class="study-map-content">${content}</article>
      </div>
      <section class="manual-note">
        <strong>Scope:</strong> These outlines cover ${esc(curriculum.subject)}. Questions stay inside that
        material, and every answer explains the idea behind it.
      </section>
    `;

    document.querySelector('#manualBack').addEventListener('click', renderMap);
    document.querySelectorAll('[data-study-lesson]').forEach((b) => {
      b.addEventListener('click', () => renderManual(Number(b.dataset.studyLesson)));
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- lesson ---------------- */

  function renderLesson(id) {
    if (!unlocked(id)) { renderMap(); return; }
    stopTicker();
    const lesson = lessons().find((x) => x.id === id);
    if (!lesson) { renderMap(); return; }
    const level = levelFor(id);
    navActive('map');
    const levelDifficulties = level.lessons
      .flatMap((l) => l.questionIds.map(getQuestion))
      .filter(Boolean)
      .map((q) => q.difficulty);
    const difficultyBand = `${Math.min(...levelDifficulties)}-${Math.max(...levelDifficulties)} of 5`;

    const teaching = lesson.teaching.map((t) => `
      <section class="content-card teaching-card"><h2>${esc(t.heading)}</h2><p>${esc(t.text)}</p></section>`).join('');

    app.className = 'view-animate';
    app.innerHTML = `
      <button class="back-link" id="lessonBack">&larr; Journey map</button>
      <header class="lesson-top" style="--level:${level.color}">
        <div class="lesson-kicker">Level ${level.id} &middot; ${esc(level.title)} &middot; Lesson ${id} of 27</div>
        <h1>${esc(lesson.title)}</h1>
        <p>${esc(lesson.subtitle)}</p>
        <span class="source-pill">${esc(curriculum.subject)} &middot; Level ${level.id}</span>
      </header>
      <div class="lesson-body">
        <article class="article">
          <section class="content-card">
            <div class="eyebrow">Before you begin</div>
            <h2>Why this lesson matters</h2>
            <p>${esc(lesson.intro)}</p>
          </section>
          ${teaching}
          <section class="scenario-card">
            <div class="eyebrow">Opponent: ${esc(opponents[level.id])}</div>
            <h2>${esc(lesson.scenario.title)}</h2>
            <p>${esc(lesson.scenario.text)}</p>
          </section>
          <section class="content-card">
            <div class="eyebrow">Ready when you are</div>
            <h2>Check your understanding</h2>
            <p>
              Ten questions, four choices each. You have ten minutes for the lesson and sixty seconds per
              question. Every answer includes an explanation and the concept it tests. You need
              8 of 10 correct to continue, and you can always retake the lesson.
            </p>
            <p class="muted">If the sixty seconds run out, ${esc(opponents[level.id])} has a
              ${Math.round(attackChance(level.id) * 100)}% chance to call ATTACK TIME and take up to a
              minute off the lesson clock.</p>
            <button class="button quiz-launch" id="startQuiz">Start the 10-question lesson check &rarr;</button>
          </section>
        </article>
        <aside class="lesson-aside">
          <section class="aside-card">
            <h3>Lesson route</h3>
            <p>Introduction &rarr; Teaching &rarr; Scenario &rarr; 10 questions &rarr; results</p>
            <p>Level ${level.id} difficulty band: ${esc(difficultyBand)}</p>
          </section>
          <section class="aside-card">
            <h3>What you'll practice</h3>
            <ul>${lesson.teaching.map((t) => `<li>${esc(t.heading)}</li>`).join('')}</ul>
          </section>
          <section class="aside-card">
            <h3>Study focus</h3>
            <p>${esc(curriculum.subject)}<br>Level ${level.id} &middot; ${esc(level.title)}<br>${esc(lesson.teaching.map((t) => t.heading).join(' &middot; '))}</p>
          </section>
        </aside>
      </div>
    `;

    document.querySelector('#lessonBack').addEventListener('click', renderMap);
    document.querySelector('#startQuiz').addEventListener('click', () => startLessonQuiz(lesson));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- quiz run ---------------- */

  function startLessonQuiz(lesson) {
    stopTicker();
    const level = levelFor(lesson.id);
    const attempt = progress.attempts[lesson.id] || 0;
    let questions = lesson.questionIds.map(getQuestion).filter(Boolean);
    if (attempt) questions = shuffle(questions);

    activeRun = {
      kind: 'lesson',
      lesson,
      level,
      questions,
      index: 0,
      answers: [],
      selected: null,
      feedback: false,
      attacks: [],
      lessonDeadline: Date.now() + CFG.lessonTimerSeconds() * 1000,
      questionDeadline: Date.now() + CFG.questionTimerSeconds() * 1000,
      ended: false,
    };
    renderQuestion();
    ticker = setInterval(tick, 200);
    tick();
  }

  function buildExamQuestions() {
    const all = lessons();
    const counts = curriculum.exam.lessonCounts;
    const picked = [];
    all.forEach((lesson, i) => {
      const pool = shuffle(lesson.questionIds.map(getQuestion).filter(Boolean));
      picked.push(...pool.slice(0, counts[i] || 0));
    });
    return shuffle(picked);
  }

  function startExam() {
    stopTicker();
    const questions = buildExamQuestions();
    activeRun = {
      kind: 'exam',
      lesson: null,
      level: null,
      questions,
      index: 0,
      answers: [],
      selected: null,
      feedback: false,
      attacks: [],
      examDeadline: Date.now() + curriculum.exam.minutes * 60 * 1000,
      ended: false,
    };
    renderQuestion();
    ticker = setInterval(tick, 200);
    tick();
  }

  function renderQuestion() {
    const run = activeRun;
    if (!run || run.ended) return;
    if (run.index >= run.questions.length) { finishRun('complete'); return; }

    const q = run.questions[run.index];
    run.selected = null;
    run.feedback = false;
    if (run.kind === 'lesson') run.questionDeadline = Date.now() + CFG.questionTimerSeconds() * 1000;

    const isExam = run.kind === 'exam';
    const headLeft = isExam ? 'THE SHADOW &middot; FINAL EXAM' : `LESSON ${run.lesson.id} &middot; QUESTION ${run.index + 1}`;
    const levelColor = isExam ? '#8f7dff' : run.level.color;

    app.className = 'view-animate';
    app.innerHTML = `
      <div class="quiz-shell">
        <button class="back-link" id="exitQuiz">&larr; ${isExam ? 'SHADOW CAT' : 'Lesson'}</button>
        <div class="question-top">
          <span>${headLeft}</span>
          <span>${isExam ? '<strong id="examClock" aria-label="Time remaining in the exam"></strong> &middot; ' : ''}${run.index + 1} / ${run.questions.length}</span>
        </div>
        <div class="question-progress"><span style="width:${(100 * run.index) / run.questions.length}%"></span></div>
        <div class="timer-strip">
          ${isExam
            ? '<div class="timer" id="examTimerCard"><span class="timer-label">Final exam clock</span><span class="timer-value" id="examClockLarge">150:00</span></div><div class="timer"><span class="timer-label">Attacks</span><span class="timer-value">None</span></div>'
            : `<div class="timer" id="lessonTimerCard"><span class="timer-label">Lesson clock</span><span class="timer-value" id="lessonClock">10:00</span></div>
               <div class="timer" id="questionTimerCard"><span class="timer-label">This question</span><span class="timer-value" id="questionClock">1:00</span></div>`}
        </div>
        <div class="attack-banner" id="attackBanner" role="status" aria-live="assertive"></div>
        <section class="quiz-card">
          <div class="rival-row">
            <img class="rival-art" src="${isExam ? ART.shadow : ART.contestant}" alt="" />
            <span class="rival-name">${esc(isExam ? 'SHADOW-1' : opponents[run.level.id])}</span>
          </div>
          <div class="question-meta">${esc(isExam ? 'SHADOW-1 asks' : `${opponents[run.level.id]} asks`)} &middot; ${esc(q.code)} &middot; Difficulty ${q.difficulty}/5</div>
          <p class="question-text">${esc(q.stem)}</p>
          <div class="choice-list" id="choiceList">
            ${q.options.map((o, i) => `<button class="choice" data-choice="${i}">
              <span class="choice-letter">${letters[i]}</span><span>${esc(o)}</span></button>`).join('')}
          </div>
          <div id="feedbackSlot"></div>
          <div class="quiz-actions">
            <span class="muted">${isExam ? 'No ATTACK TIME. Choose the best answer, then check it.' : 'Press 1-4 to choose an answer, Enter to check.'}</span>
            <button class="button" id="answerButton" disabled>Check answer</button>
          </div>
        </section>
      </div>
    `;

    document.querySelector('#exitQuiz').addEventListener('click', () => {
      if (isExam) { stopTicker(); renderExamIntro(); } else { stopTicker(); renderLesson(run.lesson.id); }
    });
    document.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (run.feedback) return;
        run.selected = Number(btn.dataset.choice);
        document.querySelectorAll('.choice').forEach((x) => {
          x.classList.toggle('selected', Number(x.dataset.choice) === run.selected);
        });
        const ab = document.querySelector('#answerButton');
        if (ab) ab.disabled = false;
      });
    });
    document.querySelector('#answerButton').addEventListener('click', gradeQuestion);
    tick();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* Keyboard play: 1-4 pick an answer, Enter checks or advances, Escape leaves the quiz. */
  function handleQuizKeys(event) {
    const run = activeRun;
    if (!run || run.ended) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      stopTicker();
      if (run.kind === 'exam') renderExamIntro();
      else renderLesson(run.lesson.id);
      return;
    }
    const answerButton = document.querySelector('#answerButton');
    if (event.key === 'Enter') {
      if (answerButton && !answerButton.disabled) { event.preventDefault(); answerButton.click(); }
      return;
    }
    if (event.key >= '1' && event.key <= '4') {
      if (run.feedback) return;
      const choice = document.querySelector(`[data-choice="${Number(event.key) - 1}"]`);
      if (choice) { event.preventDefault(); choice.click(); }
    }
  }

  function gradeQuestion() {
    const run = activeRun;
    if (!run || run.feedback || run.selected === null) return;
    const q = run.questions[run.index];
    const correct = testing.skipAnswers || run.selected === q.answer;
    recordAnswer(run, q, run.selected, correct, false);
    reveal(q, run.selected, correct, false);
  }

  function recordAnswer(run, q, selected, correct, timedOut) {
    run.feedback = true;
    run.answers.push({ question: q, selected, correct, timedOut: !!timedOut });
  }

  function reveal(q, selected, correct, timedOut) {
    const run = activeRun;
    document.querySelectorAll('.choice').forEach((btn) => {
      const i = Number(btn.dataset.choice);
      btn.disabled = true;
      btn.classList.remove('selected');
      if (testing.skipAnswers ? i === selected : i === q.answer) btn.classList.add('correct');
      else if (!testing.skipAnswers && i === selected) btn.classList.add('incorrect');
    });

    const label = timedOut
      ? '\u23F1 Time expired'
      : correct ? '\u2705 Correct' : '\u274C Incorrect';
    const chosen = selected === null || selected === undefined
      ? 'No answer was selected.'
      : `You selected ${letters[selected]}.`;

    document.querySelector('#feedbackSlot').innerHTML = `
      <div class="feedback ${correct ? 'correct' : 'incorrect'}">
        <strong>${label}</strong>
        <p>${chosen} ${esc(q.explanation)}</p>
        ${correct ? '' : `<div class="correct-answer">Correct answer: ${letters[q.answer]} &mdash; ${esc(q.options[q.answer])}</div>`}
        <div class="source"><strong>Topic:</strong> ${esc(q.topic)}</div>
      </div>`;

    const next = document.querySelector('#answerButton');
    const last = run.index + 1 >= run.questions.length;
    next.disabled = false;
    next.className = `button ${correct ? '' : 'secondary'}`;
    next.textContent = last ? 'See results' : 'Next question';
    next.onclick = () => {
      run.index += 1;
      renderQuestion();
    };
  }

  /* ---------------- clocks ---------------- */

  function tick() {
    const run = activeRun;
    if (!run || run.ended) return;
    const now = Date.now();

    if (run.kind === 'lesson') {
      const lessonLeft = (run.lessonDeadline - now) / 1000;
      const qLeft = (run.questionDeadline - now) / 1000;
      const lc = document.querySelector('#lessonClock');
      const qc = document.querySelector('#questionClock');
      const lCard = document.querySelector('#lessonTimerCard');
      const qCard = document.querySelector('#questionTimerCard');
      if (lc) lc.textContent = clock(lessonLeft);
      if (lCard) lCard.classList.toggle('danger', lessonLeft <= 60);
      if (qc && !run.feedback) {
        qc.textContent = clock(qLeft);
        if (qCard) {
          qCard.classList.toggle('urgent', qLeft <= 20 && qLeft > 10);
          qCard.classList.toggle('danger', qLeft <= 10);
        }
      } else if (qc) {
        qc.textContent = run.feedback ? 'paused' : clock(qLeft);
        if (qCard) qCard.classList.remove('urgent', 'danger');
      }

      if (lessonLeft <= 0) { finishRun('lesson-time'); return; }
      if (!run.feedback && qLeft <= 0) handleQuestionTimeout();
      return;
    }

    const examLeft = (run.examDeadline - now) / 1000;
    const small = document.querySelector('#examClock');
    const large = document.querySelector('#examClockLarge');
    const card = document.querySelector('#examTimerCard');
    if (small) small.textContent = clock(examLeft);
    if (large) large.textContent = clock(examLeft);
    if (card) card.classList.toggle('danger', examLeft <= 300);
    if (examLeft <= 0) finishRun('exam-time');
  }

  function handleQuestionTimeout() {
    const run = activeRun;
    const q = run.questions[run.index];
    recordAnswer(run, q, null, false, true);
    reveal(q, null, false, true);

    /* A rival may turn up; on a hit it steals 0-60 seconds from the lesson clock. */
    const level = run.level.id;
    const chance = attackChance(level);
    if (Math.random() < chance) {
      const cfg = curriculum.attackTime;
      const stolen = randInt(cfg.minSeconds, cfg.maxSeconds);
      run.lessonDeadline -= stolen * 1000;
      run.attacks.push({ level, stolen });
      showAttack(opponents[level], stolen);
      if (run.lessonDeadline <= Date.now()) {
        setTimeout(() => { if (activeRun === run && !run.ended) finishRun('lesson-time'); }, 1200);
      }
    } else {
      showAttack(opponents[level], null);
    }
  }

  function showAttack(name, stolen) {
    const banner = document.querySelector('#attackBanner');
    if (!banner) return;
    if (stolen === null) {
      banner.innerHTML = `<img class="attack-art" src="${ART.contestant}" alt="" />
        <div><strong>${esc(name)} circles but holds back</strong>
        <span>No ATTACK TIME this round. The lesson clock is untouched.</span></div>`;
    } else {
      banner.innerHTML = `<img class="attack-art" src="${ART.contestant}" alt="" />
        <div><strong>ATTACK TIME &mdash; ${esc(name)} strikes</strong>
        <span>${stolen} second${stolen === 1 ? '' : 's'} taken from the lesson clock.</span></div>`;
    }
    banner.classList.add('show');
  }

  /* ---------------- finish / results ---------------- */

  function finishRun(reason) {
    const run = activeRun;
    if (!run || run.ended) return;
    run.ended = true;
    stopTicker();
    if (run.kind === 'lesson') renderLessonResults(run, reason);
    else renderExamResults(run, reason);
  }

  function renderLessonResults(run, reason) {
    const correct = run.answers.filter((a) => a.correct).length;
    const total = run.questions.length;
    const percent = Math.round((100 * correct) / total);
    const threshold = CFG.masteryThreshold();
    const pausedOut = reason === 'lesson-time';
    const passed = percent >= threshold && !pausedOut;

    progress.attempts[run.lesson.id] = (progress.attempts[run.lesson.id] || 0) + 1;
    if (passed && !complete(run.lesson.id)) progress.completed.push(run.lesson.id);
    saveProgress();

    const missed = run.answers.filter((a) => !a.correct).map((a) => a.question);
    const nextL = nextLesson();

    const rows = run.answers.map((a, i) => `
      <div class="answer-row">
        <strong>${i + 1}. ${a.correct ? '&#10003; Correct' : '&#10007; Review'}</strong> &middot; ${esc(a.question.stem)}<br>
        <span class="${a.correct ? '' : 'miss'}">
          ${a.selected === null ? 'No answer' : `Your answer: ${letters[a.selected]}`} &middot;
          ${a.correct ? 'Correct' : `Correct answer: ${letters[a.question.answer]} &mdash; ${esc(a.question.options[a.question.answer])}`} &middot;
          ${esc(a.question.topic)}
        </span>
      </div>`).join('');

    const attacksNote = run.attacks.length
      ? `${opponents[run.level.id]} called ATTACK TIME ${run.attacks.length} time${run.attacks.length === 1 ? '' : 's'}, taking ${run.attacks.reduce((s, a) => s + a.stolen, 0)} seconds in total.`
      : `No ATTACK TIME was called this lesson.`;

    app.className = 'view-animate';
    app.innerHTML = `
      <div class="quiz-shell">
        <section class="quiz-card score-card">
          <div class="score-badge">${percent}%</div>
          <div class="eyebrow">Lesson ${run.lesson.id} &middot; ${esc(run.lesson.title)}</div>
          <h1>${passed ? 'Lesson mastered' : pausedOut ? 'The clock ran out' : 'Keep practicing'}</h1>
          <span class="grade-pill">${correct}/${total} correct &middot; Grade ${gradeLetter(percent)} &middot; ${threshold}% needed</span>
          <p class="result-message">
            ${pausedOut
              ? 'CAT ran out of lesson time. Anything unanswered counts against the score. Review the explanations and take the lesson again.'
              : passed
                ? `${esc(opponents[run.level.id])} steps aside. CAT moves on to the next stop, and the mastery is saved on this device.`
                : `CAT needs ${Math.ceil((threshold / 100) * total)} of ${total} to continue. Review the material and retake the lesson.`}
          </p>
          <p class="muted">${esc(attacksNote)}</p>
          <div class="result-actions">
            ${passed && nextL ? '<button class="button" id="nextStop">Next stop &rarr;</button>' : ''}
            ${passed && !nextL ? '<button class="button" id="toShadow">Meet SHADOW CAT &rarr;</button>' : ''}
            ${passed ? '' : '<button class="button" id="retake">Review &amp; retake &rarr;</button>'}
            <button class="button secondary" id="resultsMap">Journey map</button>
          </div>
          ${missed.length ? `<div class="weak-areas">
            <h2>Areas to review</h2>
            <div class="weak-grid">
              ${missed.map((q) => `<div class="weak-card weak">
                <span class="wk-head"><strong>${esc(q.code)}</strong></span>
                <small>${esc(q.stem)}</small>
                <small><strong>Topic:</strong> ${esc(q.topic)}</small>
              </div>`).join('')}
            </div>
          </div>` : ''}
          <div class="answers-review">
            <h2>Answer review</h2>
            ${rows}
          </div>
        </section>
      </div>`;

    document.querySelector('#resultsMap').addEventListener('click', renderMap);
    const retake = document.querySelector('#retake');
    if (retake) retake.addEventListener('click', () => renderLesson(run.lesson.id));
    const nextBtn = document.querySelector('#nextStop');
    if (nextBtn) nextBtn.addEventListener('click', () => renderLesson(nextL.id));
    const toShadow = document.querySelector('#toShadow');
    if (toShadow) toShadow.addEventListener('click', renderExamIntro);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- final exam ---------------- */

  function renderExamIntro() {
    stopTicker();
    navActive('map');
    if (progress.completed.length < 27 && !testerUnlocked) { renderMap(); return; }

    app.className = 'view-animate';
    app.innerHTML = `
      <section class="exam-hero boss-hero">
        <div class="boss-art">
          <img src="${ART.shadow}" alt="SHADOW-1, CAT's shadow self." />
        </div>
        <div>
          <span class="eyebrow">The last attacker</span>
          <h1>${esc(curriculum.boss.title)}</h1>
          <p>${esc(curriculum.boss.intro)}</p>
          <div class="boss-quote"><strong>SHADOW CAT:</strong> &ldquo;${esc(curriculum.boss.dialogue)}&rdquo;</div>
          <button class="button light" id="beginExam">Begin the final exam &rarr;</button>
        </div>
      </section>
      <div class="section-heading">
        <div><h2>One last test, and no tricks</h2><p>${curriculum.exam.questionCount} questions drawn from all twenty-seven lessons.</p></div>
      </div>
      <section class="exam-facts">
        <div class="exam-fact"><b>${curriculum.exam.questionCount}</b><span>questions</span></div>
        <div class="exam-fact"><b>${curriculum.exam.minutes}</b><span>minutes</span></div>
        <div class="exam-fact"><b>${curriculum.exam.passPercent}%</b><span>to pass</span></div>
        <div class="exam-fact"><b>None</b><span>artificial attacks</span></div>
      </section>
      <section class="content-card">
        <h2>The rules stay simple</h2>
        <p>
          Choose the best answer to ${curriculum.exam.questionCount} shuffled questions drawn across every
          lesson. You have ${curriculum.exam.minutes} minutes for the whole exam, and there is no ATTACK TIME:
          no opponent can touch the clock. Immediate explanations stay available.
          A score of ${curriculum.exam.passPercent}% or higher completes the journey. At the end you get
          results, a full answer review, and a breakdown of the areas that need work.
        </p>
        ${progress.examBest ? `<p class="muted">Best result so far: ${progress.examBest.percent}% (${progress.examBest.correct}/${progress.examBest.total}).</p>` : ''}
      </section>`;

    document.querySelector('#beginExam').addEventListener('click', startExam);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function renderExamResults(run, reason) {
    const correct = run.answers.filter((a) => a.correct).length;
    const total = run.questions.length;
    const percent = Math.round((100 * correct) / total);
    const threshold = curriculum.exam.passPercent;
    const timedOut = reason === 'exam-time';
    const passed = percent >= threshold && !timedOut;

    if (!progress.examBest || percent > progress.examBest.percent) {
      progress.examBest = { percent, correct, total };
    }
    if (passed) progress.examComplete = true;

    /* Persist the full exam review so it survives a reload. */
    progress.examReview = {
      at: Date.now(),
      percent, correct, total, passed, timedOut,
      rows: run.answers.map((a) => ({
        stem: a.question.stem,
        topic: a.question.topic,
        options: a.question.options,
        answer: a.question.answer,
        selected: a.selected,
        correct: a.correct,
      })),
    };
    saveProgress();

    /* Weak-area feedback, grouped by level. */
    const byLevel = new Map();
    run.answers.forEach((a) => {
      const lid = a.question.lessonId;
      const level = levelFor(lid);
      if (!level) return;
      if (!byLevel.has(level.id)) byLevel.set(level.id, { level, correct: 0, total: 0, missed: [] });
      const bucket = byLevel.get(level.id);
      bucket.total += 1;
      if (a.correct) bucket.correct += 1;
      else bucket.missed.push(a.question);
    });
    const levelStats = [...byLevel.values()]
      .map((b) => ({ ...b, percent: Math.round((100 * b.correct) / b.total) }))
      .sort((a, b) => a.percent - b.percent);
    const weakLevels = levelStats.filter((s) => s.percent < threshold);
    const unanswered = run.answers.filter((a) => a.selected === null).length;

    const weakCards = levelStats.map((s) => {
      const weak = s.percent < threshold;
      const lessonsMissed = [...new Set(s.missed.map((q) => q.lessonId))];
      return `<div class="weak-card ${weak ? 'weak' : ''}">
        <span class="wk-head"><strong>Level ${s.level.id} &middot; ${esc(s.level.title)}</strong><span>${s.correct}/${s.total} &middot; ${s.percent}%</span></span>
        <div class="bar"><div class="bar-fill" style="width:${s.percent}%"></div></div>
        <small>${weak
          ? `Needs work: ${lessonsMissed.map((id) => `Lesson ${id}`).join(', ')}`
          : 'At or above the passing mark.'}</small>
      </div>`;
    }).join('');

    const seen = new Set();
    const reviewLessonLinks = weakLevels.flatMap((s) => [...new Set(s.missed.map((q) => q.lessonId))])
      .filter((id) => (seen.has(id) ? false : seen.add(id)))
      .map((id) => {
        const l = lessons().find((x) => x.id === id);
        return `<li><button class="text-button" data-review-lesson="${id}">Lesson ${id}: ${esc(l.title)}</button></li>`;
      }).join('');

    const rows = run.answers.map((a, i) => `
      <div class="answer-row">
        <strong>${i + 1}. ${a.correct ? '&#10003; Correct' : '&#10007; Review'}</strong> &middot; ${esc(a.question.stem)}<br>
        <span class="${a.correct ? '' : 'miss'}">
          ${a.selected === null ? 'No answer' : `Your answer: ${letters[a.selected]}`} &middot;
          ${a.correct ? 'Correct' : `Correct answer: ${letters[a.question.answer]} &mdash; ${esc(a.question.options[a.question.answer])}`} &middot;
          ${esc(a.question.topic)}
        </span>
      </div>`).join('');

    app.className = 'view-animate';
    app.innerHTML = `
      <div class="quiz-shell">
        <section class="quiz-card score-card">
          <div class="score-badge">${percent}%</div>
          <div class="eyebrow">Final exam &middot; SHADOW CAT</div>
          <h1>${passed ? 'A quiet victory' : timedOut ? 'The exam clock ran out' : 'SHADOW CAT holds its ground'}</h1>
          <span class="grade-pill">${correct}/${total} correct &middot; Grade ${gradeLetter(percent)} &middot; ${threshold}% needed</span>
          <p class="result-message">
            ${timedOut
              ? 'Time expired before the last questions could be answered, and unanswered questions count against the score. Review the explanations and take the exam again.'
              : passed
                ? esc(curriculum.boss.win)
                : esc(curriculum.boss.lose)}
          </p>
          <div class="result-actions">
            ${passed ? '<button class="button" id="seeEnding">See how it ends &rarr;</button>' : '<button class="button" id="retryExam">Take the exam again</button>'}
            <button class="button secondary" id="resultsMap">Journey map</button>
          </div>

          <div class="weak-areas">
            <h2>Weak-area feedback</h2>
            <p class="muted">
              ${unanswered ? `${unanswered} question${unanswered === 1 ? '' : 's'} went unanswered. ` : ''}
              ${weakLevels.length
                ? `Levels below the ${threshold}% mark: ${weakLevels.map((s) => `Level ${s.level.id}`).join(', ')}.`
                : `Every level is at or above the ${threshold}% mark.`}
            </p>
            <div class="weak-grid">${weakCards}</div>
            ${reviewLessonLinks ? `<h2 style="margin-top:20px">Study these lessons again</h2><ul>${reviewLessonLinks}</ul>` : ''}
          </div>

          <div class="answers-review">
            <h2>Full answer review &middot; ${total} questions</h2>
            ${rows}
          </div>
        </section>
      </div>`;

    document.querySelector('#resultsMap').addEventListener('click', renderMap);
    const retry = document.querySelector('#retryExam');
    if (retry) retry.addEventListener('click', renderExamIntro);
    const ending = document.querySelector('#seeEnding');
    if (ending) ending.addEventListener('click', renderEnding);
    document.querySelectorAll('[data-review-lesson]').forEach((b) => {
      b.addEventListener('click', () => renderLesson(Number(b.dataset.reviewLesson)));
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- stored exam review ---------------- */

  function renderExamReview() {
    stopTicker();
    navActive('map');
    const review = progress.examReview;
    if (!review) { renderMap(); return; }
    const rows = review.rows.map((a, i) => `
      <div class="answer-row">
        <strong>${i + 1}. ${a.correct ? '&#10003; Correct' : '&#10007; Review'}</strong> &middot; ${esc(a.stem)}<br>
        <span class="${a.correct ? '' : 'miss'}">
          ${a.selected === null ? 'No answer' : `Your answer: ${letters[a.selected]}`} &middot;
          ${a.correct ? 'Correct' : `Correct answer: ${letters[a.answer]} &mdash; ${esc(a.options[a.answer])}`} &middot;
          ${esc(a.topic)}
        </span>
      </div>`).join('');
    app.className = 'view-animate';
    app.innerHTML = `
      <button class="back-link" id="reviewBack">&larr; Journey map</button>
      <div class="quiz-shell">
        <section class="quiz-card score-card">
          <div class="score-badge">${review.percent}%</div>
          <div class="eyebrow">Saved exam review &middot; SHADOW-1</div>
          <h1>${review.passed ? 'A quiet victory' : 'Keep practicing'}</h1>
          <span class="grade-pill">${review.correct}/${review.total} correct &middot; Grade ${gradeLetter(review.percent)}</span>
          <p class="muted">Saved in this browser on this device. Retake the exam any time to replace it.</p>
          <div class="answers-review">
            <h2>Full answer review &middot; ${review.total} questions</h2>
            ${rows}
          </div>
        </section>
      </div>`;
    document.querySelector('#reviewBack').addEventListener('click', renderMap);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- ending ---------------- */

  function renderEnding() {
    stopTicker();
    navActive('map');
    app.className = 'view-animate';
    app.innerHTML = `
      <section class="ending">
        <div class="ending-scene">
          <img class="ending-mother" src="${ART.mother}" alt="The mother who drives the red car." />
          <img class="ending-cat" src="${catArt()}" alt="CAT, warm and safe after the final exam." />
        </div>
        <span class="completion-chip">27 lessons &middot; SHADOW CAT passed</span>
        <h1>CAT FINDS A HOME</h1>
        <p>
          The red car slows at the end of the road, and the mother who drives it opens the door. Years of
          scraps and cold winters end on one ordinary afternoon: CAT rides away from the backyard, away
          from the alley, away from everything survival taught her to outrun. She knew the rules &mdash;
          she could argue about coinsurance, about care, custody and control, about the exact hour a
          house becomes vacant &mdash; and it turns out the rules were never the point. The point was the
          ride out, and the door at the end of it, standing open with a light on.
        </p>
        <p>
          In that house is a stack of cardboard boxes that is hers alone. CAT, who survived the country
          winters on scraps and won every argument with the rules, becomes the cardboard box tower
          queen. And only after that does a small black cat named BAT come into the story at all.
        </p>
        <p class="muted">
          Score on the final exam: ${progress.examBest ? `${progress.examBest.percent}% (${progress.examBest.correct}/${progress.examBest.total})` : '&mdash;'}.
          Progress is saved in this browser on this device.
        </p>
        <div class="result-actions" style="justify-content:center">
          <button class="button" id="endingMap">Walk the path again</button>
          <button class="button secondary" id="endingExam">Retake the final exam</button>
        </div>
      </section>`;
    document.querySelector('#endingMap').addEventListener('click', renderMap);
    document.querySelector('#endingExam').addEventListener('click', renderExamIntro);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------------- tester tools ---------------- */

  function wireTester() {
    const dialog = document.querySelector('#testerDialog');
    const form = document.querySelector('#testerForm');
    const input = document.querySelector('#testerPassword');
    document.querySelector('#aboutButton').addEventListener('click', () => {
      input.value = '';
      dialog.showModal();
      input.focus();
    });
    document.querySelector('#cancelTester').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input.value !== 'please') { dialog.close(); return; }
      testerPassCount += 1;
      testerUnlocked = true;
      testing.skipAnswers = testerPassCount > 1;
      dialog.close();
      const notice = document.querySelector('#testerNotice');
      notice.textContent = testerPassCount === 1 ? 'All levels unlocked.' : 'All levels unlocked; answers will be accepted.';
      notice.hidden = false;
      clearTimeout(notice.hideTimer);
      notice.hideTimer = setTimeout(() => { notice.hidden = true; }, 4000);
      if (document.querySelector('.journey')) renderMap();
      else renderMap();
    });
  }

  /* ---------------- boot ---------------- */

  function boot() {
    wireTester();
    document.addEventListener('keydown', handleQuizKeys);
    document.querySelector('[data-nav="map"]').addEventListener('click', renderMap);
    document.querySelector('[data-nav="manual"]').addEventListener('click', () => renderManual());
    document.querySelector('[data-nav="story"]').addEventListener('click', renderStory);
    document.querySelector('#resetProgress').addEventListener('click', () => {
      if (confirm('Reset CAT to the beginning and erase saved progress on this device?')) {
        progress = { completed: [], attempts: {}, examComplete: false, examBest: null, examReview: null };
        saveProgress();
        renderMap();
      }
    });
    const startBtn = document.querySelector('#startAdventure');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (curriculum) renderStory();
        else {
          const note = app.querySelector('.hero-note');
          if (note) note.textContent = 'Adventure is loading. Please wait a moment and try again.';
        }
      });
    }

    Promise.all([fetch('data/curriculum.json'), fetch('data/questions.json')])
      .then(async ([cr, qr]) => {
        if (!cr.ok || !qr.ok) throw new Error('Could not load the lesson data.');
        curriculum = await cr.json();
        bank = await qr.json();
        validateData();
        updateProgressLabel();
        if (storySeen) renderMap();
        else renderStory();
      })
      .catch((error) => {
        app.innerHTML = `<section class="content-card">
          <h1>Couldn't open the journey</h1>
          <p>${esc(error.message)} Serve this folder over HTTP (for example, python3 -m http.server) rather than opening index.html directly from disk.</p>
        </section>`;
      });
  }

  /* Data is authored by tools/build.py, which validates it at build time. These checks guard the
     runtime copy so a corrupted or truncated download cannot quietly ship a broken lesson. */
  function validateData() {
    const all = lessons();
    if (curriculum.levels.length !== 9 || all.length !== 27
        || curriculum.levels.some((lv) => lv.lessons.length !== 3)) {
      throw new Error('Curriculum must contain nine levels with three lessons each.');
    }
    if (bank.length !== 270) throw new Error('The question bank should contain 270 questions.');
    const ids = new Set(bank.map((q) => q.id));
    if (ids.size !== bank.length) throw new Error('The question bank has duplicate ids.');
    for (const q of bank) {
      if (!q.stem || q.options?.length !== 4 || new Set(q.options).size !== 4
          || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3
          || !q.explanation || !q.topic || !Number.isInteger(q.difficulty)) {
        throw new Error(`Question ${q.id || 'unknown'} has incomplete fields.`);
      }
    }
    for (const l of all) {
      if (l.questionIds.length !== 10 || l.questionIds.some((id) => !ids.has(id))) {
        throw new Error(`Lesson ${l.id} must map to ten valid questions.`);
      }
      if (l.teaching.length !== 3 || !l.scenario?.text || l.scenario.text.length < 200) {
        throw new Error(`Lesson ${l.id} is missing instruction or a full scenario.`);
      }
    }
    if (curriculum.questionsPerLesson !== 10 || curriculum.masteryThreshold !== 80) {
      throw new Error('Scoring requirements are invalid.');
    }
    if (!curriculum.exam || curriculum.exam.questionCount !== 156
        || curriculum.exam.minutes !== 150 || curriculum.exam.noAttacks !== true) {
      throw new Error('The final exam must be 156 questions in 150 minutes with no attacks.');
    }
    const blueprint = curriculum.exam.lessonCounts || [];
    if (blueprint.length !== 27 || blueprint.reduce((a, b) => a + b, 0) !== curriculum.exam.questionCount
        || blueprint.some((n) => n < 1 || n > 10)) {
      throw new Error('The final exam blueprint must draw 156 questions from all 27 lessons.');
    }
  }

  /* A tiny read-only surface so automated checks can drive the game without screen scraping. */
  window.__CAT__ = {
    get curriculum() { return curriculum; },
    get bank() { return bank; },
    get progress() { return progress; },
    get run() { return activeRun; },
    attackChance,
    buildExamQuestions,
    startLessonQuiz,
    startExam,
    renderMap,
    renderStory,
    renderLesson,
    renderExamIntro,
    renderExamReview,
    isGrownUp,
  };

  boot();
})();
