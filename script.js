/* ============================================================
   GENSHIN QUIZ BEE — SCRIPT v2
   ============================================================

   FOLDER STRUCTURE:
   ├── index.html
   ├── style.css
   ├── script.js
   ├── questions.json
   ├── fonts/
   │   └── genshin.ttf   (or .otf)
   └── audio/
       ├── timer.mp3     ← looping background during countdown
       └── timesup.mp3   ← plays when time runs out

   Edit AUDIO_CONFIG paths to match your actual files.
============================================================ */

const AUDIO_CONFIG = {
  timer:   'audio/timer.mp3',
  timesup: 'audio/timesup.mp3',
};

/* ── State ────────────────────────────────────────────────── */
const state = {
  questions:       [],
  currentIndex:    0,
  timerInterval:   null,
  timesupInterval: null,
  timeLeft:        10,
  totalTime:       10,
  timesupLeft:     5,       // seconds the Time's Up overlay shows
  answered:        false,
  timerRunning:    false,
  shuffledChoices: [],
  audioTimer:      null,
  audioTimesup:    null,
};

/* ── DOM ──────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const dom = {
  timerBar:        $('timer-bar'),
  timerNumber:     $('timer-number'),
  timerFill:       $('timer-fill'),
  questionText:    $('question-text'),
  choicesGrid:     $('choices-grid'),
  btnShowAnswer:   $('btn-show-answer'),
  btnNext:         $('btn-next'),
  btnStartTimer:   $('btn-start-timer'),
  timesupOverlay:  $('timesup-overlay'),
  timesupCountBar: $('timesup-countdown-bar'),
  questionCounter: $('question-counter'),
  introScreen:     $('intro-screen'),
  btnIntroStart:   $('btn-intro-start'),
  completeScreen:  $('complete-screen'),
  completeStars:   $('complete-stars'),
  flashOverlay:    $('flash-overlay'),
  vignette:        $('bg-vignette'),
};

/* ═══════════════════════════════════════════════════════════
   AUDIO
═══════════════════════════════════════════════════════════ */

function initAudio() {
  state.audioTimer   = new Audio(AUDIO_CONFIG.timer);
  state.audioTimesup = new Audio(AUDIO_CONFIG.timesup);
  state.audioTimer.loop    = true;
  state.audioTimer.preload = 'auto';
  state.audioTimesup.preload = 'auto';
}

function playAudio(audio) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function stopAudio(audio) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function stopAllAudio() {
  stopAudio(state.audioTimer);
  stopAudio(state.audioTimesup);
}

/* ═══════════════════════════════════════════════════════════
   LOAD QUESTIONS
═══════════════════════════════════════════════════════════ */

async function loadQuestions() {
  try {
    const res  = await fetch('questions.json');
    const data = await res.json();
    state.questions = data;
  } catch (e) {
    console.warn('Could not load questions.json:', e);
    state.questions = [
      {
        question: "Failed to load questions.json — please check the file path.",
        choices:  ["Check the path", "Reload the page", "Edit questions.json", "All of the above"],
        answer:   "All of the above"
      }
    ];
  }
}

/* ═══════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════ */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function triggerFlash() {
  dom.flashOverlay.classList.remove('flash');
  void dom.flashOverlay.offsetWidth;
  dom.flashOverlay.classList.add('flash');
}

function hideAllActionBtns() {
  dom.btnShowAnswer.classList.remove('visible');
  dom.btnNext.classList.remove('visible');
  dom.btnStartTimer.classList.remove('visible');
}

function showBtn(btn) {
  btn.classList.add('visible');
}

/* ═══════════════════════════════════════════════════════════
   RENDER QUESTION
═══════════════════════════════════════════════════════════ */

function renderQuestion(index) {
  const q = state.questions[index];
  if (!q) return;

  state.answered     = false;
  state.timerRunning = false;
  state.shuffledChoices = shuffle(q.choices);

  // Counter
  dom.questionCounter.innerHTML =
    `Question <span>${index + 1}</span> / ${state.questions.length}`;

  // Question text — animate in
  dom.questionText.classList.remove('q-enter');
  void dom.questionText.offsetWidth;
  dom.questionText.textContent = q.question;
  dom.questionText.classList.add('q-enter');

  // Reset timer UI to full (but don't start)
  state.timeLeft = state.totalTime;
  updateTimerUI(false);

  // Build choices (locked until timer starts)
  buildChoices(q);

  // Hide all action buttons first, then show Start Timer
  hideAllActionBtns();

  // Small delay so choices entrance animation completes first
  setTimeout(() => showBtn(dom.btnStartTimer), 320);
}

/* ═══════════════════════════════════════════════════════════
   BUILD CHOICES
═══════════════════════════════════════════════════════════ */

function buildChoices(q) {
  dom.choicesGrid.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  state.shuffledChoices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn waiting'; // locked
    btn.setAttribute('data-choice', choice);
    btn.style.animationDelay = `${i * 0.09}s`;

    btn.innerHTML = `
      <span class="choice-shimmer"></span>
      <span class="choice-letter">${letters[i]}</span>
      <span class="choice-text">${choice}</span>
    `;

    btn.addEventListener('click', () => onChoiceClick(btn, choice, q.answer));
    dom.choicesGrid.appendChild(btn);
  });
}

/* ═══════════════════════════════════════════════════════════
   UNLOCK CHOICES
═══════════════════════════════════════════════════════════ */

function unlockChoices() {
  $$('.choice-btn').forEach(btn => {
    /*btn.classList.remove('waiting');
    btn.disabled = false; */
    // Re-trigger entrance animation for a "ready" visual pop
    btn.style.animation = 'none';
    void btn.offsetWidth;
    btn.style.animation = '';
    btn.style.animationDelay = '0s';
  });
}

function lockChoices() {
  $$('.choice-btn').forEach(btn => { btn.disabled = true; });
}

/* ═══════════════════════════════════════════════════════════
   TIMER
═══════════════════════════════════════════════════════════ */

function startTimer() {
  clearInterval(state.timerInterval);
  state.timerRunning = true;
  state.timeLeft     = state.totalTime;
  updateTimerUI(false);

  state.timerInterval = setInterval(() => {
    state.timeLeft = Math.max(0, state.timeLeft - 0.1);
    const urgent = state.timeLeft <= 3;
    updateTimerUI(urgent);

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      state.timerRunning = false;
      onTimeUp();
    }
  }, 100);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  dom.vignette.classList.remove('urgent');
  dom.timerNumber.classList.remove('urgent');
  dom.timerFill.classList.remove('urgent');
  dom.timerBar.classList.remove('urgent');
}

function updateTimerUI(urgent = false) {
  const pct = state.timeLeft / state.totalTime;
  const displayNum = Math.ceil(state.timeLeft);

  dom.timerBar.style.width  = `${pct * 100}%`;
  dom.timerFill.style.width = `${pct * 100}%`;
  dom.timerNumber.textContent = displayNum;

  dom.timerNumber.classList.toggle('urgent', urgent);
  dom.timerFill.classList.toggle('urgent',   urgent);
  dom.timerBar.classList.toggle('urgent',    urgent);
  dom.vignette.classList.toggle('urgent',    urgent);
}

/* ═══════════════════════════════════════════════════════════
   START TIMER BUTTON
═══════════════════════════════════════════════════════════ */

dom.btnStartTimer.addEventListener('click', () => {
  // Hide the start button
  dom.btnStartTimer.classList.remove('visible');

  // Unlock choices with a staggered pop
  $$('.choice-btn').forEach((btn, i) => {
    setTimeout(() => {
      btn.classList.remove('waiting');
      btn.disabled = false;
      // mini pop animation
      btn.style.animation = 'none';
      void btn.offsetWidth;
      btn.style.animation  = 'choiceEnter 0.35s cubic-bezier(0.34,1.3,0.64,1) both';
      btn.style.animationDelay = '0s';
    }, i * 60);
  });

  // Brief dramatic pause then start
  setTimeout(() => {
    triggerFlash();
    startTimer();
    playAudio(state.audioTimer);
  }, 280);
});

/* ═══════════════════════════════════════════════════════════
   TIME'S UP
═══════════════════════════════════════════════════════════ */

function onTimeUp() {
  stopAllAudio();
  playAudio(state.audioTimesup);
  lockChoices();
  dom.vignette.classList.remove('urgent');

  // Show overlay
  dom.timesupOverlay.classList.add('show');

  // 5-second countdown bar inside overlay
  state.timesupLeft = 5;
  dom.timesupCountBar.style.width = '100%';

  const step = 100;
  state.timesupInterval = setInterval(() => {
    state.timesupLeft -= step / 1000;
    const pct = Math.max(0, state.timesupLeft / 5);
    dom.timesupCountBar.style.width = `${pct * 100}%`;

    if (state.timesupLeft <= 0) {
      clearInterval(state.timesupInterval);
      dismissTimesUp();
    }
  }, step);
}

function dismissTimesUp() {
  dom.timesupOverlay.classList.remove('show');
  stopAudio(state.audioTimesup);

  setTimeout(() => {
    triggerFlash();
    showBtn(dom.btnShowAnswer);
  }, 400);
}

/* ═══════════════════════════════════════════════════════════
   CHOICE CLICK
═══════════════════════════════════════════════════════════ */

function onChoiceClick(btn, choice, answer) {
  if (state.answered || !state.timerRunning) return;
  state.answered = true;
  stopTimer();
  stopAllAudio();
  lockChoices();

  if (choice === answer) {
    btn.classList.add('correct');
    spawnCorrectParticles(btn);
  } else {
    btn.classList.add('incorrect');
    // brief delay before revealing correct
    setTimeout(() => highlightCorrect(answer), 350);
  }

  setTimeout(() => showBtn(dom.btnNext), 700);
}

/* ═══════════════════════════════════════════════════════════
   ANSWER REVEAL
═══════════════════════════════════════════════════════════ */

function highlightCorrect(answer) {
  $$('.choice-btn').forEach(btn => {
    if (btn.getAttribute('data-choice') === answer) {
      btn.classList.add('correct');
      spawnCorrectParticles(btn);
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   CORRECT ANSWER PARTICLE BURST
═══════════════════════════════════════════════════════════ */

function spawnCorrectParticles(btn) {
  const rect    = btn.getBoundingClientRect();
  const cx      = rect.left + rect.width  / 2;
  const cy      = rect.top  + rect.height / 2;
  const count   = 14;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      left: ${cx}px; top: ${cy}px;
      width: ${3 + Math.random() * 5}px;
      height: ${3 + Math.random() * 5}px;
      border-radius: 50%;
      background: ${Math.random() > 0.5 ? '#c9aa71' : '#6fcf97'};
      pointer-events: none;
      z-index: 500;
      box-shadow: 0 0 6px rgba(201,170,113,0.8);
    `;
    document.body.appendChild(el);

    const angle    = (360 / count) * i + Math.random() * 20;
    const dist     = 60 + Math.random() * 80;
    const rad      = angle * Math.PI / 180;
    const tx       = Math.cos(rad) * dist;
    const ty       = Math.sin(rad) * dist;
    const duration = 0.5 + Math.random() * 0.4;

    el.animate([
      { transform: 'translate(-50%,-50%) scale(1)',   opacity: 1 },
      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 },
    ], { duration: duration * 1000, easing: 'cubic-bezier(0,0,0.2,1)', fill: 'forwards' })
      .onfinish = () => el.remove();
  }
}

/* ═══════════════════════════════════════════════════════════
   SHOW ANSWER BUTTON
═══════════════════════════════════════════════════════════ */

dom.btnShowAnswer.addEventListener('click', () => {
  const q = state.questions[state.currentIndex];
  highlightCorrect(q.answer);
  dom.btnShowAnswer.classList.remove('visible');
  setTimeout(() => showBtn(dom.btnNext), 400);
});

/* ═══════════════════════════════════════════════════════════
   NEXT BUTTON
═══════════════════════════════════════════════════════════ */

dom.btnNext.addEventListener('click', () => {
  state.currentIndex++;
  if (state.currentIndex >= state.questions.length) {
    showComplete();
    return;
  }
  triggerFlash();
  hideAllActionBtns();
  // Slight delay for flash to peak
  setTimeout(() => renderQuestion(state.currentIndex), 120);
});

/* ═══════════════════════════════════════════════════════════
   COMPLETE SCREEN
═══════════════════════════════════════════════════════════ */

function showComplete() {
  stopAllAudio();
  triggerFlash();
  setTimeout(() => {
    dom.completeScreen.classList.add('show');
    dom.completeStars.querySelectorAll('.complete-star').forEach((s, i) => {
      setTimeout(() => {
        s.style.opacity   = '1';
        s.style.transform = 'scale(1) rotate(0deg)';
      }, 350 + i * 150);
    });
  }, 200);
}

$('btn-restart').addEventListener('click', () => {
  dom.completeScreen.classList.remove('show');
  dom.completeStars.querySelectorAll('.complete-star').forEach(s => {
    s.style.opacity   = '0';
    s.style.transform = 'scale(0) rotate(-30deg)';
  });
  state.currentIndex = 0;
  triggerFlash();
  setTimeout(() => renderQuestion(0), 150);
});

/* ═══════════════════════════════════════════════════════════
   INTRO SCREEN
═══════════════════════════════════════════════════════════ */

dom.btnIntroStart.addEventListener('click', () => {
  dom.introScreen.classList.add('fade-out');
  setTimeout(() => {
    dom.introScreen.style.display = 'none';
    triggerFlash();
    setTimeout(() => renderQuestion(0), 120);
  }, 700);
});

/* ═══════════════════════════════════════════════════════════
   PARTICLES BACKGROUND
═══════════════════════════════════════════════════════════ */

function createParticles() {
  const container = document.querySelector('.particles');
  // 3 types: gold dust, blue motes, green wisps
  const types = [
    { color: 'rgba(201,170,113,0.7)', size: [2, 5] },
    { color: 'rgba(74,144,217,0.5)',  size: [1.5, 3] },
    { color: 'rgba(111,207,151,0.4)', size: [1.5, 3] },
  ];

  for (let i = 0; i < 30; i++) {
    const t    = types[i % types.length];
    const p    = document.createElement('div');
    p.className = 'particle';
    const size = t.size[0] + Math.random() * (t.size[1] - t.size[0]);
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      background:radial-gradient(circle,${t.color},transparent 70%);
      animation-duration:${10 + Math.random()*14}s;
      animation-delay:${Math.random()*12}s;
    `;
    container.appendChild(p);
  }
}

/* ═══════════════════════════════════════════════════════════
   ORBITING INTRO RUNES
═══════════════════════════════════════════════════════════ */

function createIntroRunes() {
  const wrap  = document.querySelector('.intro-rune-wrap');
  if (!wrap) return;
  const runes = ['✦','✧','⬧','◆','✦','✧','⬦','◇'];
  runes.forEach((r, i) => {
    const el = document.createElement('div');
    el.className  = 'intro-rune';
    el.textContent = r;
    const startDeg = (360 / runes.length) * i;
    const duration = 18 + i * 2;
    el.style.setProperty('--start', `${startDeg}deg`);
    el.style.animationDuration  = `${duration}s`;
    el.style.animationDelay     = `${-i * 1.5}s`;
    wrap.appendChild(el);
  });
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */

async function init() {
  createParticles();
  createIntroRunes();
  initAudio();
  await loadQuestions();
  // Waiting for intro Start button click
}

init();
