const FALLBACK_PROMPT = 'Go outside and consider a cloud.';

const HEART_EMOJIS = [
  // hearts
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🩷', '🩵', '🤍', '💗', '💓', '💕',
  // sky & nature
  '☁️', '🌸', '🌺', '🌻', '🌼', '🌷', '🍀', '🦋', '🌈', '✨', '🌟', '⭐', '🌙',
  // fruit & food
  '🍌', '🍉', '🍓', '🍒', '🍑', '🍋', '🥑', '🍩', '🧁', '🍪', '🍦', '🌮',
  // creatures
  '🐸', '🐙', '🦄', '🐝', '🦊', '🐧', '🦩', '🐬', '🐳', '🐞',
  // silly/fun
  '🎈', '🎉', '🎊', '🎸', '🌊', '🎵', '💫', '🌀', '🥳', '🪄', '🦭', '🫧',
];
// ponytail: cap at 80 DOM nodes; bump or switch to 1-per-N if the site grows large
const HEARTS_MAX = 80;
let _heartsInit = false;

function _seededRand(seed) {
  // mulberry32 — fast, good distribution, one-liner seed from date
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const _d = new Date();
const _rand = _seededRand(_d.getFullYear() * 10000 + (_d.getMonth() + 1) * 100 + _d.getDate());

function _makeHeart() {
  const span = document.createElement('span');
  span.textContent = HEART_EMOJIS[Math.floor(_rand() * HEART_EMOJIS.length)];
  span.style.setProperty('--dur',   `${8 + _rand() * 12}s`);
  span.style.setProperty('--delay', `${-(_rand() * 20)}s`);
  span.style.setProperty('--sz',    `${0.8 + _rand() * 1.2}rem`);
  span.style.setProperty('--alpha', `${0.15 + _rand() * 0.2}`);
  span.style.setProperty('--rot',   `${-25 + _rand() * 50}deg`);
  span.style.left = `${_rand() * 98}%`;
  return span;
}

function renderHearts(count) {
  if (_heartsInit) return;
  _heartsInit = true;
  const bg = document.getElementById('heart-bg');
  if (!bg) return;
  const n = Math.min(count || 0, HEARTS_MAX);
  for (let i = 0; i < n; i++) bg.appendChild(_makeHeart());
}

function addHeart() {
  const bg = document.getElementById('heart-bg');
  if (!bg || bg.children.length >= HEARTS_MAX) return;
  bg.appendChild(_makeHeart());
}
const FALLBACK_CONNECTION = 'I found my sky today';
const FALLBACK_REBEL = 'I marched to my own drum';
const SITE_URL = 'https://logoff.world';

const PLATFORMS = [
  { id: 'twitter',   label: 'X / Twitter' },
  { id: 'bluesky',   label: 'Bluesky' },
  { id: 'threads',   label: 'Threads' },
  { id: 'mastodon',  label: 'Mastodon (copy text)' },
  { id: 'facebook',  label: 'Facebook' },
  { id: 'reddit',    label: 'Reddit' },
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'whatsapp',  label: 'WhatsApp' },
  { id: 'telegram',  label: 'Telegram' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'substack',  label: 'Substack Notes (copy text)' },
  { id: 'copy',      label: 'Copy link' },
];

let _promptItem = null;

function todayKey() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
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
    _promptItem = pickByDay(data);
    document.getElementById('daily-prompt').textContent = _promptItem ? _promptItem.text : FALLBACK_PROMPT;
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
    renderHearts(data.lifetimeTotal);
  } catch (err) {
    if (err.status !== 501) console.warn('Stats unavailable:', err.message);
  }
}

function buildShareText(choice, phrase, total) {
  if (_promptItem) {
    const field = choice === 'connection' ? _promptItem.connection_share : _promptItem.rebel_share;
    if (field) return field;
  }
  return choice === 'connection'
    ? `"${phrase}" — a genuine human moment. ${total} of us paused today without an algorithm telling us to. Share this, then close this app.`
    : `"${phrase}" — I did my own thing instead. ${total} humans checked in today, zero of them needed a feed. Share this, then go live your actual life.`;
}

function getShareUrl(platform, fullText) {
  const et = encodeURIComponent(fullText);
  const eu = encodeURIComponent(SITE_URL);
  switch (platform) {
    case 'twitter':   return `https://twitter.com/intent/tweet?text=${et}`;
    case 'bluesky':   return `https://bsky.app/intent/compose?text=${et}`;
    case 'threads':   return `https://www.threads.net/intent/post?text=${et}`;
    case 'facebook':  return `https://www.facebook.com/sharer/sharer.php?u=${eu}`;
    case 'reddit':    return `https://reddit.com/submit?url=${eu}&title=${encodeURIComponent(fullText.split('\n')[0])}`;
    case 'linkedin':  return `https://www.linkedin.com/sharing/share-offsite/?url=${eu}`;
    case 'whatsapp':  return `https://wa.me/?text=${et}`;
    case 'telegram':  return `https://t.me/share/url?url=${eu}&text=${et}`;
    case 'pinterest': return `https://pinterest.com/pin/create/button/?url=${eu}&description=${et}`;
    default: return null;
  }
}

function handlePlatformShare(platform, shareText, btn) {
  const fullText = shareText + '\n\n→ ' + SITE_URL;
  const copyPlatforms = ['mastodon', 'substack', 'copy'];

  if (copyPlatforms.includes(platform)) {
    const toCopy = platform === 'copy' ? SITE_URL : fullText;
    navigator.clipboard?.writeText(toCopy).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    });
    window.plausible?.('share_click', { props: { method: platform } });
    return;
  }

  const url = getShareUrl(platform, fullText);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
  window.plausible?.('share_click', { props: { method: platform } });
}

function showShareSection(choice, data) {
  const today = formatDate(new Date());
  const promptText = document.getElementById('daily-prompt').textContent;
  const phraseEl = choice === 'connection'
    ? document.getElementById('connection-phrase')
    : document.getElementById('rebel-phrase');
  const phrase = phraseEl.textContent;

  document.getElementById('brag-date').textContent = today;
  document.getElementById('brag-prompt').textContent = promptText;
  document.getElementById('brag-phrase').textContent = phrase;
  document.getElementById('brag-count').textContent = `Joined by ${data.total} humans`;
  document.getElementById('share-section').hidden = false;

  const shareText = buildShareText(choice, phrase, data.total);

  const dropdown = document.getElementById('share-dropdown');
  dropdown.innerHTML = '';
  PLATFORMS.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'share-option';
    btn.textContent = label;
    btn.addEventListener('click', () => handlePlatformShare(id, shareText, btn));
    dropdown.appendChild(btn);
  });

  document.getElementById('btn-share-primary').onclick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Log Off', text: shareText, url: SITE_URL });
        window.plausible?.('share_click', { props: { method: 'native' } });
        return;
      } catch {}
    }
    dropdown.hidden = !dropdown.hidden;
  };

  // Close dropdown on outside click
  document.addEventListener('click', function closeDropdown(e) {
    if (!e.target.closest('.share-buttons')) {
      dropdown.hidden = true;
      document.removeEventListener('click', closeDropdown);
    }
  });
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

    localStorage.setItem(`lo_has_voted_${todayKey()}`, 'true');
    localStorage.setItem(`lo_brag_${todayKey()}`, JSON.stringify({ choice, total: data.total }));
    setVoted();
    updateCounters(data);
    addHeart();
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

  await Promise.all([loadPrompt(), loadPhrases()]);

  if (localStorage.getItem(`lo_has_voted_${todayKey()}`)) {
    setVoted();
    const brag = localStorage.getItem(`lo_brag_${todayKey()}`);
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
