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

function showShareSection(choice, data) {
  const today = formatDate(new Date());
  const prompt = document.getElementById('daily-prompt').textContent;
  const phraseEl = choice === 'connection'
    ? document.getElementById('connection-phrase')
    : document.getElementById('rebel-phrase');
  const phrase = phraseEl.textContent;

  document.getElementById('brag-date').textContent = today;
  document.getElementById('brag-prompt').textContent = prompt;
  document.getElementById('brag-phrase').textContent = phrase;
  document.getElementById('brag-count').textContent = `Joined by ${data.total} humans today`;

  document.getElementById('share-section').hidden = false;

  const twitterBtn = document.getElementById('btn-share-twitter');
  const copyBtn = document.getElementById('btn-share-copy');

  twitterBtn.onclick = () => {
    const text = `"${phrase}" — joined by ${data.total} humans today. One prompt. No algorithms. #PeopleOverTech`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://peopleover.tech')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    window.plausible?.('share_click', { props: { method: 'twitter' } });
  };

  copyBtn.onclick = () => {
    const siteUrl = 'https://peopleover.tech';
    window.plausible?.('share_click', { props: { method: 'copy' } });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(siteUrl).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy link';
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    } else {
      prompt(`Copy this link:`, siteUrl);
    }
  };
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
    localStorage.setItem(`pot_brag_${todayKey()}`, JSON.stringify({ choice, total: data.total }));
    setVoted();
    updateCounters(data);
    showShareSection(choice, data);

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

function onPulse() {
  loadStats();
}

async function init() {
  document.getElementById('today-date').textContent = formatDate(new Date());

  await Promise.all([loadPrompt(), loadPhrases(), loadCharity()]);

  if (localStorage.getItem(`pot_has_voted_${todayKey()}`)) {
    setVoted();
    const brag = localStorage.getItem(`pot_brag_${todayKey()}`);
    if (brag) {
      try {
        const { choice, total } = JSON.parse(brag);
        showShareSection(choice, { total });
      } catch {}
    }
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
