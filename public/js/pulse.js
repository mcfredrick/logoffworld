class PulseClient {
  constructor({ pollUrl, wsUrl = null, interval = 5000 }) {
    this.pollUrl = pollUrl;
    this.wsUrl = wsUrl;
    this.interval = interval;
    this.lastCounts = null;
    this.pollTimer = null;
    this.ws = null;
    this.onPulse = null;
    this.pendingCount = 0;
    this.pendingResetTimer = null;
  }

  start(onPulse) {
    this.onPulse = onPulse;

    if (this.wsUrl) {
      this._connectWebSocket();
    } else {
      this._startPolling();
    }
  }

  stop() {
    clearInterval(this.pollTimer);
    this.pollTimer = null;

    clearTimeout(this.pendingResetTimer);
    this.pendingResetTimer = null;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  triggerLocal(type) {
    this._animate(type, false);
  }

  _connectWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type && this.onPulse) {
            this._dispatchPulse(data.type);
          }
        } catch (_) {}
      });

      this.ws.addEventListener('error', () => {
        this._fallbackToPolling();
      });

      this.ws.addEventListener('close', () => {
        this._fallbackToPolling();
      });
    } catch (_) {
      this._fallbackToPolling();
    }
  }

  _fallbackToPolling() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws = null;
    }
    if (!this.pollTimer) {
      this._startPolling();
    }
  }

  _startPolling() {
    this._fetchAndCompare();
    this.pollTimer = setInterval(() => this._fetchAndCompare(), this.interval);
  }

  async _fetchAndCompare() {
    try {
      const res = await fetch(this.pollUrl);
      if (!res.ok) return;

      const data = await res.json();
      const { connection, rebel } = data;

      if (this.lastCounts !== null) {
        const connectionDelta = connection - this.lastCounts.connection;
        const rebelDelta = rebel - this.lastCounts.rebel;

        if (connectionDelta > 0) {
          const times = Math.min(connectionDelta, 5);
          for (let i = 0; i < times; i++) {
            this._dispatchPulse('connection');
          }
        }

        if (rebelDelta > 0) {
          const times = Math.min(rebelDelta, 5);
          for (let i = 0; i < times; i++) {
            this._dispatchPulse('rebel');
          }
        }
      }

      this.lastCounts = { connection, rebel };
    } catch (_) {}
  }

  _dispatchPulse(type) {
    if (this.onPulse) {
      this.onPulse({ type, delta: 1 });
    }

    this.pendingCount++;

    if (!this.pendingResetTimer) {
      this.pendingResetTimer = setTimeout(() => {
        this.pendingCount = 0;
        this.pendingResetTimer = null;
      }, 1000);
    }

    this._animate(type, this.pendingCount > 5);
  }

  _animate(type, wave) {
    if (!document.body) return;

    const emoji = type === 'connection' ? '☁️' : '🥁';
    const el = document.createElement('div');

    el.textContent = emoji;
    el.className = wave ? 'floating-pulse floating-pulse-wave' : 'floating-pulse';

    if (wave) {
      el.style.fontSize = '4rem';
    }

    el.style.left = `${10 + Math.random() * 80}%`;

    document.body.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2500);
  }
}
