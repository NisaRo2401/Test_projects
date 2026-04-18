// ihk-exam-trainer — App-Logik
// Vanilla ES-Module. Nutzt window.auth / window.supabase (bereits via <script> geladen).

// ── Konstanten ─────────────────────────────────────
const EXAM_CONFIG = {
  AP1:  { label: 'AP1 — Einrichten eines IT-Arbeitsplatzes', durationMin: 90, defaultQuestions: 40 },
  GA1:  { label: 'AP2 GA1 — Entwicklung',                    durationMin: 90, defaultQuestions: 40 },
  GA2:  { label: 'AP2 GA2 — Projektbegleitend',              durationMin: 90, defaultQuestions: 40 },
  WiSo: { label: 'WiSo — Wirtschafts- und Sozialkunde',      durationMin: 60, defaultQuestions: 30 },
};

// IHK-Notenschlüssel (vereinfachtes AEVO-Schema)
function calcGrade(pct) {
  if (pct >= 92) return '1';
  if (pct >= 81) return '2';
  if (pct >= 67) return '3';
  if (pct >= 50) return '4';
  if (pct >= 30) return '5';
  return '6';
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = a.slice().sort((x, y) => x - y);
  const sb = b.slice().sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

// ── App-State ─────────────────────────────────────
const state = {
  client: null,
  userId: null,
  questions: [],     // alle geladen
  progress: new Map(), // question_id → row
  topicFilter: 'ALL',
  currentTopic: null,
  currentQuestionId: null,
  sim: null,         // { examPart, questions, answers, marks, timerId, endsAt, currentIdx, sessionId }
  lastResult: null,  // { session, answers, questions }
};

// ── Helpers ───────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function setView(name) {
  $('#iet-app').dataset.view = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function badge(text) {
  const b = document.createElement('span');
  b.className = 'badge';
  b.textContent = text;
  return b;
}

// ── Supabase-Daten laden ──────────────────────────
async function initSupabase() {
  await waitForAuth();
  const session = await window.auth.getSession();
  if (!session) throw new Error('Keine Session');
  state.client = window.auth.getClient();
  state.userId = session.user.id;
}

function waitForAuth() {
  return new Promise((res, rej) => {
    const started = Date.now();
    const tick = () => {
      if (window.auth && typeof window.auth.getSession === 'function') return res();
      if (Date.now() - started > 5000) return rej(new Error('auth.js nicht geladen'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function loadQuestions() {
  const { data, error } = await state.client
    .from('questions')
    .select('id, exam_part, exam_year, exam_season, topic, subtopic, question, options, correct_indices, hint, solution, difficulty, has_diagram, diagram_url, source_page')
    .order('topic', { ascending: true })
    .order('difficulty', { ascending: true });
  if (error) throw error;
  state.questions = data || [];
}

async function loadProgress() {
  const { data, error } = await state.client
    .from('user_progress')
    .select('question_id, attempts, correct_count, last_correct, last_answered_at')
    .eq('user_id', state.userId);
  if (error) throw error;
  state.progress.clear();
  for (const row of data || []) state.progress.set(row.question_id, row);
}

async function upsertProgress(questionId, correct) {
  const existing = state.progress.get(questionId);
  const row = {
    user_id: state.userId,
    question_id: questionId,
    attempts: (existing?.attempts || 0) + 1,
    correct_count: (existing?.correct_count || 0) + (correct ? 1 : 0),
    last_correct: correct,
    last_answered_at: new Date().toISOString(),
  };
  const { error } = await state.client
    .from('user_progress')
    .upsert(row, { onConflict: 'user_id,question_id' });
  if (error) {
    console.error('Progress-Upsert fehlgeschlagen:', error);
    return;
  }
  state.progress.set(questionId, row);
}

// ── Home: Gesamtfortschritt ───────────────────────
function renderHome() {
  const total = state.questions.length;
  const answered = Array.from(state.progress.values())
    .filter(p => state.questions.some(q => q.id === p.question_id)).length;
  const correct = Array.from(state.progress.values())
    .filter(p => p.last_correct === true).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  $('#ietOverallBar').style.width = pct + '%';
  $('#ietOverallPct').textContent = pct + '%';
  $('#ietOverallNote').textContent = `${answered} von ${total} Fragen beantwortet · ${correct} richtig`;
  setView('home');
}

// ── Themen-Liste ──────────────────────────────────
function groupByTopic(questions) {
  const map = new Map();
  for (const q of questions) {
    if (!map.has(q.topic)) map.set(q.topic, []);
    map.get(q.topic).push(q);
  }
  return map;
}

function renderTopics() {
  const list = $('#ietTopicList');
  list.innerHTML = '';
  const filtered = state.topicFilter === 'ALL'
    ? state.questions
    : state.questions.filter(q => q.exam_part === state.topicFilter);
  const grouped = groupByTopic(filtered);
  const sorted = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], 'de'));

  if (sorted.length === 0) {
    list.innerHTML = '<p class="iet-muted">Keine Fragen für diesen Filter. Importiere mehr PDFs.</p>';
    setView('topics');
    return;
  }

  for (const [topic, qs] of sorted) {
    const total = qs.length;
    const answered = qs.filter(q => state.progress.has(q.id)).length;
    const correct = qs.filter(q => state.progress.get(q.id)?.last_correct === true).length;
    const pct = total ? Math.round((answered / total) * 100) : 0;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'iet-topic-card';
    card.innerHTML = `
      <div>
        <div class="iet-topic-head">
          <h3>${escapeHtml(topic)}</h3>
          <span class="badge">${total} Frage${total === 1 ? '' : 'n'}</span>
        </div>
        <div class="iet-topic-stats">${answered}/${total} beantwortet · ${accuracy}% richtig</div>
      </div>
      <div class="iet-topic-pct">${pct}%</div>
      <div class="iet-topic-bar-wrap">
        <div class="iet-progress iet-progress-sm"><div class="iet-progress-fill" style="width:${pct}%"></div></div>
      </div>
    `;
    card.addEventListener('click', () => startTopic(topic));
    list.appendChild(card);
  }
  setView('topics');
}

// ── Themen-Training: Frage rendern ────────────────
function startTopic(topic) {
  state.currentTopic = topic;
  const qs = state.questions
    .filter(q => q.topic === topic)
    .filter(q => state.topicFilter === 'ALL' || q.exam_part === state.topicFilter);
  // Reihenfolge: unbeantwortet zuerst, dann zuletzt falsch, dann zuletzt richtig
  const sorted = qs.sort((a, b) => {
    const pa = state.progress.get(a.id);
    const pb = state.progress.get(b.id);
    const weightA = !pa ? 0 : pa.last_correct ? 2 : 1;
    const weightB = !pb ? 0 : pb.last_correct ? 2 : 1;
    return weightA - weightB;
  });
  state.currentQuestionId = sorted[0]?.id || null;
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions.find(x => x.id === state.currentQuestionId);
  if (!q) {
    $('#ietQText').textContent = 'Keine Fragen in diesem Thema.';
    $('#ietQForm').innerHTML = '';
    setView('question');
    return;
  }

  // Meta
  const meta = $('#ietQMeta');
  meta.innerHTML = '';
  meta.appendChild(badge(q.topic));
  if (q.subtopic) meta.appendChild(badge(q.subtopic));
  meta.appendChild(badge(`${q.exam_part} ${q.exam_season || ''} ${q.exam_year || ''}`.trim()));
  meta.appendChild(badge(q.difficulty));
  if (q.source_page) meta.appendChild(badge(`S.${q.source_page}`));

  // Diagramm
  const diag = $('#ietQDiagram');
  if (q.has_diagram && q.diagram_url) {
    diag.innerHTML = `<img src="${q.diagram_url}" alt="Diagramm">`;
    diag.hidden = false;
  } else {
    diag.innerHTML = '';
    diag.hidden = true;
  }

  // Text + Optionen
  $('#ietQText').textContent = q.question;
  const form = $('#ietQForm');
  form.innerHTML = '';
  const isMulti = q.correct_indices.length > 1;
  q.options.forEach((opt, idx) => {
    const letter = String.fromCharCode(65 + idx);
    const label = document.createElement('label');
    label.className = 'iet-option';
    label.dataset.idx = idx;
    label.innerHTML = `
      <input type="${isMulti ? 'checkbox' : 'radio'}" name="iet-opt" value="${idx}">
      <span class="iet-option-letter">${letter}</span>
      <span class="iet-option-text">${escapeHtml(opt)}</span>
    `;
    form.appendChild(label);
  });

  // Reset UI
  $('#ietHintBox').hidden = true;
  $('#ietFeedback').hidden = true;
  $('#ietSolution').hidden = true;
  $('#ietSolution .iet-solution-body').hidden = true;
  $('#ietCheckBtn').hidden = false;
  $('#ietNextBtn').hidden = true;
  $('#ietHintBtn').disabled = false;

  // Topic-Progressbar
  updateTopicBar();
  setView('question');
}

function updateTopicBar() {
  const qs = state.questions.filter(q => q.topic === state.currentTopic);
  const answered = qs.filter(q => state.progress.has(q.id)).length;
  const pct = qs.length ? Math.round((answered / qs.length) * 100) : 0;
  $('#ietTopicBar').style.width = pct + '%';
  $('#ietTopicNote').textContent = `${answered}/${qs.length} in ${state.currentTopic}`;
}

async function handleCheckAnswer() {
  const q = state.questions.find(x => x.id === state.currentQuestionId);
  if (!q) return;
  const selected = $$('input[name="iet-opt"]', $('#ietQForm'))
    .filter(i => i.checked)
    .map(i => Number(i.value));
  if (selected.length === 0) {
    $('#ietFeedback').textContent = 'Bitte mindestens eine Option wählen.';
    $('#ietFeedback').className = 'iet-feedback is-err';
    $('#ietFeedback').hidden = false;
    return;
  }
  const correct = arraysEqual(selected, q.correct_indices);

  // Optionen markieren
  $$('label.iet-option', $('#ietQForm')).forEach((label, idx) => {
    const input = label.querySelector('input');
    input.disabled = true;
    label.classList.add('is-disabled');
    if (q.correct_indices.includes(idx)) label.classList.add('is-correct');
    else if (selected.includes(idx)) label.classList.add('is-wrong');
  });

  const fb = $('#ietFeedback');
  fb.className = 'iet-feedback ' + (correct ? 'is-ok' : 'is-err');
  fb.textContent = correct ? '✓ Richtig!' : '✗ Leider falsch.';
  fb.hidden = false;

  $('#ietSolution').hidden = false;
  $('#ietSolution .iet-solution-body').innerHTML = renderMarkdown(q.solution);
  $('#ietCheckBtn').hidden = true;
  $('#ietNextBtn').hidden = false;
  $('#ietHintBtn').disabled = true;

  await upsertProgress(q.id, correct);
  updateTopicBar();
}

function handleShowHint() {
  const q = state.questions.find(x => x.id === state.currentQuestionId);
  if (!q) return;
  const box = $('#ietHintBox');
  box.textContent = q.hint || 'Kein Hinweis für diese Frage hinterlegt.';
  box.hidden = false;
  $('#ietHintBtn').disabled = true;
}

function handleToggleSolution() {
  const body = $('#ietSolution .iet-solution-body');
  body.hidden = !body.hidden;
  const btn = $('#ietSolution .iet-solution-toggle');
  btn.textContent = body.hidden ? 'Musterlösung anzeigen ▾' : 'Musterlösung ausblenden ▴';
}

function handleNextQuestion() {
  const topicQs = state.questions
    .filter(q => q.topic === state.currentTopic)
    .filter(q => state.topicFilter === 'ALL' || q.exam_part === state.topicFilter);
  // Bevorzuge noch nicht beantwortete oder zuletzt falsche Fragen
  const unanswered = topicQs.find(q => !state.progress.has(q.id));
  const wrong = topicQs.find(q => state.progress.get(q.id)?.last_correct === false && q.id !== state.currentQuestionId);
  const next = unanswered || wrong || topicQs.find(q => q.id !== state.currentQuestionId);
  if (!next) {
    alert('Alle Fragen in diesem Thema bearbeitet. Zurück zur Themen-Liste.');
    renderTopics();
    return;
  }
  state.currentQuestionId = next.id;
  renderQuestion();
}

// ── Simulation: Setup ─────────────────────────────
function renderSimSetup() {
  const container = $('#ietSimParts');
  container.innerHTML = '';
  for (const [part, cfg] of Object.entries(EXAM_CONFIG)) {
    const available = state.questions.filter(q => q.exam_part === part).length;
    const card = document.createElement('button');
    card.className = 'iet-sim-part-card';
    card.type = 'button';
    if (available < 5) card.disabled = true;
    card.innerHTML = `
      <h4>${cfg.label.split(' — ')[0]}</h4>
      <p>${escapeHtml(cfg.label.split(' — ')[1] || '')}</p>
      <p><strong>${cfg.durationMin} Min</strong> · ${Math.min(cfg.defaultQuestions, available)} Fragen${available < cfg.defaultQuestions ? ` (nur ${available} verfügbar)` : ''}</p>
    `;
    card.addEventListener('click', () => startSimulation(part));
    container.appendChild(card);
  }
  setView('sim-setup');
}

// ── Simulation: Start ─────────────────────────────
async function startSimulation(examPart) {
  const cfg = EXAM_CONFIG[examPart];
  const pool = state.questions.filter(q => q.exam_part === examPart);
  if (pool.length < 5) {
    alert('Nicht genug Fragen für diesen Prüfungsteil.');
    return;
  }
  const count = Math.min(cfg.defaultQuestions, pool.length);
  const simQuestions = shuffle(pool).slice(0, count);

  const { data: session, error } = await state.client
    .from('exam_sessions')
    .insert({
      user_id: state.userId,
      exam_part: examPart,
      total_questions: count,
    })
    .select('id')
    .single();
  if (error) {
    console.error(error);
    alert('Konnte Session nicht anlegen: ' + error.message);
    return;
  }

  state.sim = {
    examPart,
    questions: simQuestions,
    answers: new Array(count).fill(null),
    marks: new Array(count).fill(false),
    currentIdx: 0,
    sessionId: session.id,
    endsAt: Date.now() + cfg.durationMin * 60 * 1000,
    startedAt: Date.now(),
    timerId: null,
  };
  $('#ietSimPart').textContent = cfg.label;
  state.sim.timerId = setInterval(tickTimer, 1000);
  tickTimer();
  renderSimQuestion();
}

function tickTimer() {
  if (!state.sim) return;
  const remainSec = Math.max(0, Math.floor((state.sim.endsAt - Date.now()) / 1000));
  const timer = $('#ietSimTimer');
  timer.textContent = formatDuration(remainSec);
  timer.classList.toggle('is-warning', remainSec <= 600 && remainSec > 60);
  timer.classList.toggle('is-critical', remainSec <= 60);
  if (remainSec <= 0) {
    submitSimulation(true);
  }
}

function renderSimQuestion() {
  if (!state.sim) return;
  const idx = state.sim.currentIdx;
  const q = state.sim.questions[idx];

  $('#ietSimCounter').textContent = `Frage ${idx + 1} / ${state.sim.questions.length}`;
  $('#ietSimQText').textContent = q.question;

  const diag = $('#ietSimDiagram');
  if (q.has_diagram && q.diagram_url) {
    diag.innerHTML = `<img src="${q.diagram_url}" alt="Diagramm">`;
    diag.hidden = false;
  } else {
    diag.innerHTML = '';
    diag.hidden = true;
  }

  const form = $('#ietSimForm');
  form.innerHTML = '';
  const isMulti = q.correct_indices.length > 1;
  const saved = state.sim.answers[idx] || [];
  q.options.forEach((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const label = document.createElement('label');
    label.className = 'iet-option';
    label.innerHTML = `
      <input type="${isMulti ? 'checkbox' : 'radio'}" name="iet-sim-opt" value="${i}" ${saved.includes(i) ? 'checked' : ''}>
      <span class="iet-option-letter">${letter}</span>
      <span class="iet-option-text">${escapeHtml(opt)}</span>
    `;
    label.addEventListener('change', saveCurrentAnswer);
    form.appendChild(label);
  });

  renderSimPager();
  $('#ietSimMarkBtn').textContent = state.sim.marks[idx] ? '★ Markiert' : 'Markieren';
  setView('sim');
}

function saveCurrentAnswer() {
  if (!state.sim) return;
  const idx = state.sim.currentIdx;
  const selected = $$('input[name="iet-sim-opt"]', $('#ietSimForm'))
    .filter(i => i.checked)
    .map(i => Number(i.value));
  state.sim.answers[idx] = selected.length ? selected : null;
  renderSimPager();
}

function renderSimPager() {
  const pager = $('#ietSimPager');
  pager.innerHTML = '';
  state.sim.questions.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'iet-pager-dot';
    dot.textContent = String(i + 1);
    if (i === state.sim.currentIdx) dot.classList.add('is-current');
    if (state.sim.answers[i]) dot.classList.add('is-answered');
    if (state.sim.marks[i]) dot.classList.add('is-marked');
    dot.addEventListener('click', () => {
      saveCurrentAnswer();
      state.sim.currentIdx = i;
      renderSimQuestion();
    });
    pager.appendChild(dot);
  });
}

function handleSimPrev() {
  if (!state.sim) return;
  saveCurrentAnswer();
  if (state.sim.currentIdx > 0) {
    state.sim.currentIdx -= 1;
    renderSimQuestion();
  }
}

function handleSimNext() {
  if (!state.sim) return;
  saveCurrentAnswer();
  if (state.sim.currentIdx < state.sim.questions.length - 1) {
    state.sim.currentIdx += 1;
    renderSimQuestion();
  }
}

function handleSimMark() {
  if (!state.sim) return;
  const idx = state.sim.currentIdx;
  state.sim.marks[idx] = !state.sim.marks[idx];
  $('#ietSimMarkBtn').textContent = state.sim.marks[idx] ? '★ Markiert' : 'Markieren';
  renderSimPager();
}

async function submitSimulation(auto = false) {
  if (!state.sim) return;
  if (!auto && !confirm(`Prüfung jetzt abgeben? ${state.sim.answers.filter(a => a).length}/${state.sim.questions.length} beantwortet.`)) {
    return;
  }
  saveCurrentAnswer();
  clearInterval(state.sim.timerId);

  const answersDetail = state.sim.questions.map((q, i) => {
    const selected = state.sim.answers[i] || [];
    const correct = selected.length > 0 && arraysEqual(selected, q.correct_indices);
    return { question_id: q.id, selected, correct };
  });
  const correctCount = answersDetail.filter(a => a.correct).length;
  const total = state.sim.questions.length;
  const scorePct = total ? (correctCount / total) * 100 : 0;
  const grade = calcGrade(scorePct);
  const durationSec = Math.round((Date.now() - state.sim.startedAt) / 1000);

  await state.client
    .from('exam_sessions')
    .update({
      finished_at: new Date().toISOString(),
      duration_sec: durationSec,
      correct_count: correctCount,
      score_pct: scorePct,
      grade,
      answers: answersDetail,
    })
    .eq('id', state.sim.sessionId);

  // Auch user_progress mit Simulationsergebnissen updaten
  for (let i = 0; i < state.sim.questions.length; i++) {
    const q = state.sim.questions[i];
    const a = answersDetail[i];
    if (a.selected.length > 0) {
      await upsertProgress(q.id, a.correct);
    }
  }

  const session = {
    id: state.sim.sessionId,
    exam_part: state.sim.examPart,
    duration_sec: durationSec,
    correct_count: correctCount,
    total_questions: total,
    score_pct: scorePct,
    grade,
  };
  state.lastResult = {
    session,
    answers: answersDetail,
    questions: state.sim.questions,
  };
  state.sim = null;
  renderResult(auto);
}

function renderResult(autoSubmitted = false) {
  const { session, answers, questions } = state.lastResult;
  const cfg = EXAM_CONFIG[session.exam_part];
  $('#ietResultTitle').textContent = autoSubmitted ? 'Zeit abgelaufen — Ergebnis' : 'Ergebnis';
  $('#ietResultSub').textContent = `${cfg.label} · Dauer ${formatDuration(session.duration_sec)}`;
  $('#ietResultGrade').textContent = session.grade;
  $('#ietResultBar').style.width = session.score_pct.toFixed(1) + '%';
  $('#ietResultPct').textContent = `${session.correct_count} / ${session.total_questions} richtig · ${session.score_pct.toFixed(1)}%`;

  // Aufschlüsselung nach Thema
  const byTopic = new Map();
  questions.forEach((q, i) => {
    const entry = byTopic.get(q.topic) || { total: 0, correct: 0 };
    entry.total += 1;
    if (answers[i].correct) entry.correct += 1;
    byTopic.set(q.topic, entry);
  });
  const breakdown = $('#ietResultByTopic');
  breakdown.innerHTML = '';
  const sorted = Array.from(byTopic.entries()).sort((a, b) => a[0].localeCompare(b[0], 'de'));
  for (const [topic, { total, correct }] of sorted) {
    const row = document.createElement('div');
    row.className = 'iet-breakdown-row';
    row.innerHTML = `<span class="iet-breakdown-topic">${escapeHtml(topic)}</span><span class="iet-breakdown-score">${correct} / ${total}</span>`;
    breakdown.appendChild(row);
  }
  setView('result');
}

function renderReview() {
  if (!state.lastResult) return;
  const { answers, questions } = state.lastResult;
  const list = $('#ietReviewList');
  list.innerHTML = '';
  const wrong = answers
    .map((a, i) => ({ a, q: questions[i] }))
    .filter(({ a }) => !a.correct);
  if (wrong.length === 0) {
    list.innerHTML = '<p class="iet-muted">Alle richtig beantwortet. 🎉</p>';
    setView('review');
    return;
  }
  for (const { a, q } of wrong) {
    const item = document.createElement('div');
    item.className = 'iet-review-item';
    const correctTexts = q.correct_indices.map(i => `${String.fromCharCode(65 + i)}) ${q.options[i]}`).join(' · ');
    const selectedTexts = a.selected.length
      ? a.selected.map(i => `${String.fromCharCode(65 + i)}) ${q.options[i]}`).join(' · ')
      : '(keine Antwort)';
    item.innerHTML = `
      <strong>${escapeHtml(q.topic)}:</strong> ${escapeHtml(q.question)}
      <div class="iet-correct">Richtig: ${escapeHtml(correctTexts)}</div>
      <div class="iet-selected">Deine Antwort: ${escapeHtml(selectedTexts)}</div>
      <div class="iet-explain">${renderMarkdown(q.solution)}</div>
    `;
    list.appendChild(item);
  }
  setView('review');
}

async function renderHistory() {
  const { data, error } = await state.client
    .from('exam_sessions')
    .select('id, exam_part, started_at, finished_at, duration_sec, correct_count, total_questions, score_pct, grade')
    .eq('user_id', state.userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(50);
  const list = $('#ietHistoryList');
  list.innerHTML = '';
  if (error || !data || data.length === 0) {
    list.innerHTML = '<p class="iet-muted">Noch keine abgeschlossenen Simulationen.</p>';
    setView('history');
    return;
  }
  for (const s of data) {
    const cfg = EXAM_CONFIG[s.exam_part] || { label: s.exam_part };
    const when = new Date(s.finished_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    const item = document.createElement('div');
    item.className = 'iet-history-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(cfg.label)}</strong>
        <div class="iet-history-meta">${when} · ${formatDuration(s.duration_sec || 0)} · ${s.correct_count}/${s.total_questions}</div>
      </div>
      <div class="iet-history-score">
        ${Number(s.score_pct || 0).toFixed(0)}% · Note ${s.grade}
      </div>
    `;
    list.appendChild(item);
  }
  setView('history');
}

// ── Markdown (minimal) ────────────────────────────
function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');
  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// ── Event-Delegation ──────────────────────────────
function bindEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    switch (action) {
      case 'reload':           return location.reload();
      case 'go-home':          return renderHome();
      case 'go-topics':        return renderTopics();
      case 'go-sim-setup':     return renderSimSetup();
      case 'go-history':       return renderHistory();
      case 'show-hint':        return handleShowHint();
      case 'check-answer':     return handleCheckAnswer();
      case 'next-question':    return handleNextQuestion();
      case 'toggle-solution':  return handleToggleSolution();
      case 'sim-prev':         return handleSimPrev();
      case 'sim-next':         return handleSimNext();
      case 'sim-mark':         return handleSimMark();
      case 'submit-sim':       return submitSimulation(false);
      case 'review-wrong':     return renderReview();
      case 'back-to-result':   return renderResult();
    }
  });

  // Topic-Filter
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.iet-filter');
    if (!btn) return;
    $$('.iet-filter').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.topicFilter = btn.dataset.part;
    renderTopics();
  });

  // Warnung vor Verlassen während laufender Simulation
  window.addEventListener('beforeunload', (e) => {
    if (state.sim) { e.preventDefault(); e.returnValue = ''; }
  });
}

// ── Init ──────────────────────────────────────────
async function main() {
  try {
    await initSupabase();
    await Promise.all([loadQuestions(), loadProgress()]);
    bindEvents();
    if (state.questions.length === 0) {
      setView('empty');
      return;
    }
    renderHome();
  } catch (err) {
    console.error('Init-Fehler:', err);
    const app = $('#iet-app');
    app.dataset.view = 'empty';
    const card = app.querySelector('[data-view-name="empty"] .card');
    card.innerHTML = `<h2>Fehler</h2><p>${escapeHtml(err.message || String(err))}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', main);
