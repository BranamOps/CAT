#!/usr/bin/env node
/* Real-browser checks for CAT using Playwright + headless Chromium.
 * Verifies rendered layout (including a phone-sized viewport), tap targets,
 * live timers, ATTACK TIME, and a full lesson run through the real DOM.
 *
 *   PLAYWRIGHT_PATH=/path/to/playwright node tools/browser-check.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(__dirname, '..');
const BASE = 'http://cat.local/CAT/index.html';
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.png': 'image/png', '.ico': 'image/x-icon',
};

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

async function serve(page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    let p = url.pathname.replace(/^\/CAT/, '');
    if (p === '/' || p === '') p = '/index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({
      status: 200,
      contentType: TYPES[path.extname(file)] || 'application/octet-stream',
      body: fs.readFileSync(file),
    });
  });
}

async function boot(browser, viewport, overrides) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  if (overrides) await context.addInitScript((o) => { window.__CAT_TEST__ = o; }, overrides);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await serve(page);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__CAT__ && window.__CAT__.bank && window.__CAT__.bank.length === 405, null, { timeout: 15000 });
  return { context, page, errors };
}

const right = (box) => box.x + box.width;

async function overflow(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const widest = [...document.querySelectorAll('*')].reduce((max, el) => {
      const r = el.getBoundingClientRect();
      return Math.max(max, r.right);
    }, 0);
    return { scroll: d.scrollWidth, client: d.clientWidth, widest };
  });
}

async function main() {
  const browser = await chromium.launch();

  /* ---------------- mobile ---------------- */
  console.log('\nA. Phone viewport (390 x 844)');
  {
    const { context, page, errors } = await boot(browser, { width: 390, height: 844 });
    ok(errors.length === 0, 'no console or page errors on load', errors.slice(0, 2).join(' | '));

    let o = await overflow(page);
    ok(o.scroll <= o.client + 1, 'landing has no horizontal overflow', `scroll ${o.scroll} vs client ${o.client}`);

    const heroVisible = await page.isVisible('.hero');
    ok(heroVisible, 'hero is visible on a phone');
    const heroSrc = await page.getAttribute('.hero-art img', 'src');
    ok(/CAT_young\.jpg/.test(heroSrc || ''), 'the phone landing shows the young CAT art', heroSrc);
    const goalSrc = await page.getAttribute('.goal-art img', 'src');
    ok(/MOTHER\.jpg/.test(goalSrc || ''), 'the phone landing shows the goal art', goalSrc);

    const heroBox = await page.locator('.hero h1').boundingBox();
    ok(heroBox && heroBox.width > 100 && right(heroBox) <= 391, 'hero heading fits inside the phone width',
      heroBox ? `right=${Math.round(right(heroBox))}` : 'missing');

    const navBox = await page.locator('.topnav').boundingBox();
    ok(navBox && right(navBox) <= 391, 'top navigation fits inside the phone width',
      navBox ? `right=${Math.round(right(navBox))}` : 'missing');

    await page.screenshot({ path: '/tmp/cat-mobile-landing.png', fullPage: false });

    // journey map
    await page.click('[data-nav="map"]');
    await page.waitForSelector('.journey');
    ok(await page.locator('.stop').count() === 27, 'map shows 27 lesson stops on a phone');
    ok(await page.locator('.level-band').count() === 9, 'map shows 9 level bands');
    o = await overflow(page);
    ok(o.scroll <= o.client + 1, 'journey map has no horizontal overflow', `scroll ${o.scroll}`);
    await page.screenshot({ path: '/tmp/cat-mobile-map.png', fullPage: false });

    // lesson
    await page.click('.stop[data-lesson="1"]');
    await page.waitForSelector('#startQuiz');
    ok(await page.isVisible('.lesson-aside'), 'lesson aside renders');
    await page.click('#startQuiz');
    await page.waitForSelector('.quiz-card');
    ok(await page.locator('.choice').count() === 4, 'four answer choices render');
    ok(await page.isVisible('#lessonClock'), 'lesson clock is visible');
    ok(await page.isVisible('#questionClock'), 'per-question clock is visible');

    await page.keyboard.press('2');
    ok(await page.evaluate(() => window.__CAT__.run.selected === 1), 'the keyboard selects an answer in a real browser');

    const choiceBox = await page.locator('.choice').first().boundingBox();
    ok(choiceBox && choiceBox.height >= 40, 'choice buttons are a comfortable tap target', choiceBox ? String(Math.round(choiceBox.height)) : 'missing');
    ok(choiceBox && choiceBox.x >= 0 && right(choiceBox) <= 391, 'choice buttons fit the phone width',
      choiceBox ? `right=${Math.round(right(choiceBox))}` : 'missing');
    o = await overflow(page);
    ok(o.scroll <= o.client + 1, 'quiz has no horizontal overflow', `scroll ${o.scroll} widest ${Math.round(o.widest)}`);
    await page.screenshot({ path: '/tmp/cat-mobile-quiz.png', fullPage: false });

    // the contestant turns up and triples both clocks
    await page.evaluate(() => { window.__CAT__.run.contestant.nextAt = 0; });
    await page.waitForSelector('#contestantSlot:not([hidden])', { timeout: 5000 });
    ok(true, 'the contestant turns up in a real browser');
    const bubble = await page.textContent('#contestantBubble');
    ok(bubble && bubble.trim().length >= 3, 'the contestant shouts one of the cries', bubble);
    const contestantSrc = await page.getAttribute('.contestant-art', 'src');
    ok(/contestant-[123]\.jpg/.test(contestantSrc || ''), 'a contestant portrait is on screen', contestantSrc);
    ok(await page.evaluate(() => document.querySelector('.timer-strip').classList.contains('spedup')),
      'the clocks are marked as tripled');
    const portraits = await page.evaluate(async () => {
      const srcs = window.__CAT__.contestantArts;
      const results = await Promise.all(srcs.map((src) => new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img.naturalWidth > 0);
        img.onerror = () => res(false);
        img.src = src;
      })));
      return { count: srcs.length, loaded: results.filter(Boolean).length };
    });
    ok(portraits.count === 3 && portraits.loaded === 3,
      'all three contestant portraits load in the browser',
      `${portraits.loaded}/${portraits.count}`);

    // live timers
    const t1 = await page.textContent('#questionClock');
    await page.waitForTimeout(1400);
    const t2 = await page.textContent('#questionClock');
    ok(t1 !== t2, 'the per-question clock actually counts down', `${t1} -> ${t2}`);
    const l1 = await page.textContent('#lessonClock');
    const l2 = await page.textContent('#lessonClock');
    ok(/^\d+:\d{2}$/.test(l1) && /^\d+:\d{2}$/.test(l2), 'lesson clock renders as m:ss');

    // full lesson run, answering correctly
    for (let i = 0; i < 10; i += 1) {
      await page.evaluate(() => {
        const run = window.__CAT__.run;
        const q = run.questions[run.index];
        document.querySelector(`[data-choice="${q.answer}"]`).click();
        document.querySelector('#answerButton').click();
        document.querySelector('#answerButton').click();
      });
    }
    await page.waitForSelector('.score-badge');
    const score = await page.textContent('.score-badge');
    ok(score.trim() === '100%', 'a fully correct lesson run scores 100% in the browser', score);
    ok((await page.textContent('#app')).includes('Lesson mastered'), 'lesson result reports mastery');
    o = await overflow(page);
    ok(o.scroll <= o.client + 1, 'results view has no horizontal overflow', `scroll ${o.scroll}`);
    await page.screenshot({ path: '/tmp/cat-mobile-results.png', fullPage: false });

    await context.close();
  }

  /* ---------------- ATTACK TIME in a real browser ---------------- */
  console.log('\nB. ATTACK TIME (forced, 1-second question clock)');
  {
    const { context, page } = await boot(browser, { width: 390, height: 844 },
      { questionTimerSeconds: 1, lessonTimerSeconds: 300, attackChanceForced: 1 });
    await page.evaluate(() => window.__CAT__.startLessonQuiz(window.__CAT__.curriculum.levels[7].lessons[0]));
    await page.waitForSelector('#attackBanner.show', { timeout: 6000 });
    const text = await page.textContent('#attackBanner');
    ok(/THE HIGHWAY CAT STRIKES/.test(text), 'the level rival strike banner appears in the browser', text.trim().slice(0, 70));
    ok(!/SHADOW CAT/.test(text), 'SHADOW CAT does not strike outside level 9');
    ok(await page.evaluate(() => window.__CAT__.run.attacks.length === 1), 'the attack was recorded');
    const vis = await page.isVisible('#attackBanner.show');
    ok(vis, 'attack banner is visible');
    const o = await overflow(page);
    ok(o.scroll <= o.client + 1, 'attack banner does not break the layout', `scroll ${o.scroll}`);
    await page.screenshot({ path: '/tmp/cat-mobile-attack.png', fullPage: false });
    await context.close();
  }

  /* ---------------- desktop ---------------- */
  console.log('\nC. Desktop viewport (1366 x 900)');
  {
    const { context, page, errors } = await boot(browser, { width: 1366, height: 900 });
    ok(errors.length === 0, 'no console errors on desktop', errors.slice(0, 2).join(' | '));
    let o = await overflow(page);
    ok(o.scroll <= o.client + 1, 'desktop landing has no horizontal overflow');
    const grid = await page.locator('.levels-grid .level-card').count();
    ok(grid === 9, 'landing lists all nine levels', String(grid));
    await page.screenshot({ path: '/tmp/cat-desktop-landing.png', fullPage: false });

    await page.click('[data-nav="manual"]');
    await page.waitForSelector('.study-map-layout');
    await page.click('[data-study-lesson="17"]');
    ok((await page.textContent('.study-map-content')).includes('Dwelling'),
      'study guide renders the selected lesson content');
    await page.screenshot({ path: '/tmp/cat-desktop-manual.png', fullPage: false });

    // exam intro + exam screen
    await page.evaluate(() => {
      const p = window.__CAT__.progress;
      window.__CAT__.curriculum.levels.flatMap((l) => l.lessons).forEach((l) => {
        if (!p.completed.includes(l.id)) p.completed.push(l.id);
      });
      window.__CAT__.renderExamIntro();
    });
    await page.waitForSelector('#beginExam');
    await page.click('#beginExam');
    await page.waitForSelector('#examClockLarge');
    ok((await page.textContent('.question-top')).includes('1 / 156'), 'exam shows 156 questions');
    ok((await page.textContent('.timer-strip')).includes('None'), 'exam states no attacks');
    o = await overflow(page);
    ok(o.scroll <= o.client + 1, 'exam view has no horizontal overflow');
    await page.screenshot({ path: '/tmp/cat-desktop-exam.png', fullPage: false });
    await context.close();
  }

  await browser.close();
  console.log(`\n${checks - failures}/${checks} browser checks passed.`);
  console.log('Screenshots: /tmp/cat-mobile-landing.png, cat-mobile-map.png, cat-mobile-quiz.png, cat-mobile-results.png, cat-mobile-attack.png, cat-desktop-*.png');
  if (failures) { console.log(`${failures} FAILED.`); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error('browser-check crashed:', e); process.exit(1); });
