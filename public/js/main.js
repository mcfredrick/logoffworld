const FALLBACK_PROMPT = 'Go outside and consider a cloud.';
const FALLBACK_CONNECTION = 'I found my sky today';
const FALLBACK_REBEL = 'I marched to my own drum';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

function pickByDay(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[dayOfYear(new Date()) % arr.length];
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function animateCounter(el) {
  el.classList.add('updated');
  setTimeout(() => el.classList.remove('updated'), 300);
}

function updateCounters(data) {
  const total = document.getElementById('counter-total');
  const conn = document.getElementById('counter-connection');
  const reb = document.getElementById('counter-rebel');

  const newTotal = Number.isInteger(data.total) ? String(data.total) : '—';
  const newConn = Number.isInteger(data.connection) ? `☁️ ${data.connection}` : '☁️ —';
  const newReb = Number.isInteger(data.rebel) ? `🥁 ${data.rebel}` : '🥁 —';

  if (total.textContent !== newTotal) { total.textContent = newTotal; animateCounter(total); }
  if (conn.textContent !== newConn) { conn.textContent = newConn; animateCounter(conn); }
  if (reb.textContent !== newReb) { reb.textContent = newReb; animateCounter(reb); }
}

function setVoted() {
  document.getElementById('btn-connection').disabled = true;
  document.getElementById('btn-rebel').disabled = true;
  document.getElementById('voted-message').hidden = false;
}

function showError(msg) {
  let el = document.getElementById('vote-error');
  if (!el) {
    el = document.createElement('p');
    el.id = 'vote-error';
    el.className = 'error-message';
    document.querySelector('.vote').after(el);
  }
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.json();
}

async function loadPrompt() {
  try {
    const data = await fetchJSON('/data/prompts.json');
    const item = pickByDay(data);
    document.getElementById('daily-prompt').textContent = item ? item.text : FALLBACK_PROMPT;
  } catch {
    document.getElementById('daily-prompt').textContent = FALLBACK_PROMPT;
  }
}

async function loadPhrases() {
  try {
    const data = await fetchJSON('/data/phrases.json');
    const conn = pickByDay(data.connection);
    const reb = pickByDay(data.rebel);
    if (conn) document.getElementById('connection-phrase').textContent = conn.text;
    if (reb) document.getElementById('rebel-phrase').textContent = reb.text;
  } catch {
    document.getElementById('connection-phrase').textContent = FALLBACK_CONNECTION;
    document.getElementById('rebel-phrase').textContent = FALLBACK_REBEL;
  }
}

async function loadStats() {
  try {
    const data = await fetchJSON('/api/stats');
    updateCounters(data);
  } catch (err) {
    if (err.status !== 501) console.warn('Stats unavailable:', err.message);
  }
}

async function loadCharity() {
  try {
    const data = await fetchJSON('/data/charity.json');
    if (!data || !data.name) return;
    const banner = document.getElementById('charity-banner');
    const link = document.createElement('a');
    link.href = data.url || '#';
    link.rel = 'noopener noreferrer';
    link.textContent = data.name;
    banner.append('This month we support ', link, ` — ${data.tagline}`);
  } catch {
    // no charity data
  }
}

async function handleVote(choice) {
  const btnConn = document.getElementById('btn-connection');
  const btnReb = document.getElementById('btn-rebel');
  btnConn.disabled = true;
  btnReb.disabled = true;

  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    localStorage.setItem(`pot_has_voted_${todayKey()}`, 'true');
    setVoted();
    updateCounters(data);

    if (typeof PulseClient !== 'undefined' && window._pulse) {
      window._pulse.triggerLocal(choice);
    }

    window.plausible?.('vote_cast', { props: { choice } });
  } catch (err) {
    btnConn.disabled = false;
    btnReb.disabled = false;
    showError('Something went wrong. Please try again.');
    console.error('Vote failed:', err.message);
  }
}

function onPulse(data) {
  updateCounters(data);
}

async function init() {
  document.getElementById('today-date').textContent = formatDate(new Date());

  await Promise.all([loadPrompt(), loadPhrases(), loadCharity()]);

  if (localStorage.getItem(`pot_has_voted_${todayKey()}`)) {
    setVoted();
  } else {
    document.getElementById('btn-connection').addEventListener('click', () => handleVote('connection'));
    document.getElementById('btn-rebel').addEventListener('click', () => handleVote('rebel'));
  }

  await loadStats();

  if (typeof PulseClient !== 'undefined') {
    window._pulse = new PulseClient({ pollUrl: '/api/stats' });
    window._pulse.start(onPulse);
  }
}

init();
