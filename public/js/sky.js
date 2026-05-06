(() => {
  // WMO weather code mapping (Open-Meteo)
  const WMO = {
    0:  { kind: "clear" },
    1:  { kind: "fewClouds" },
    2:  { kind: "partCloud" },
    3:  { kind: "overcast" },
    45: { kind: "fog" },
    48: { kind: "fog" },
    51: { kind: "rainLight" },
    53: { kind: "rainLight" },
    55: { kind: "rain" },
    56: { kind: "rainLight" },
    57: { kind: "rain" },
    61: { kind: "rainLight" },
    63: { kind: "rain" },
    65: { kind: "rain" },
    66: { kind: "rain" },
    67: { kind: "rain" },
    71: { kind: "snowLight" },
    73: { kind: "snow" },
    75: { kind: "snow" },
    77: { kind: "snowLight" },
    80: { kind: "rainLight" },
    81: { kind: "rain" },
    82: { kind: "rain" },
    85: { kind: "snow" },
    86: { kind: "snow" },
    95: { kind: "storm" },
    96: { kind: "storm" },
    99: { kind: "storm" },
  };

  // Rough sun position from lat/lon + current time
  function sunPos(lat, lon, when = new Date()) {
    const utcH = when.getUTCHours() + when.getUTCMinutes() / 60;
    const solarH = ((utcH + lon / 15) + 24) % 24;
    const start = Date.UTC(when.getUTCFullYear(), 0, 0);
    const N = Math.floor((when - start) / 86400000);
    const decl = 23.44 * Math.sin(((360 / 365) * (N - 81)) * Math.PI / 180);
    const hourAngle = (solarH - 12) * 15;
    const latR = lat * Math.PI / 180;
    const decR = decl * Math.PI / 180;
    const haR  = hourAngle * Math.PI / 180;
    const sinAlt = Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(haR);
    const altDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    const cosAz = (Math.sin(decR) - Math.sin(latR) * sinAlt) / (Math.cos(latR) * Math.cos(Math.asin(sinAlt)) || 1e-6);
    let azDeg = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
    if (haR > 0) azDeg = 360 - azDeg;
    const x = Math.max(5, Math.min(95, ((azDeg - 90) / 180) * 80 + 10));
    const y = Math.max(8, Math.min(110, 100 - ((altDeg + 10) / 80) * 92));
    return {
      x, y,
      alt: Math.max(0, Math.min(1, (altDeg + 6) / 60)),
      isDay: altDeg > -2,
    };
  }

  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return "#" + [r, g, bl].map(v => v.toString(16).padStart(2, "0")).join("");
  }

  function palette({ kind, tempC, sun }) {
    const { isDay, alt } = sun;
    const goldenHour = isDay && alt < 0.18;

    const daySky = {
      clear:      ["#cfe4f5", "#a9cdec", "#88b6dd", "#6f9fcf"],
      fewClouds:  ["#d6e6f3", "#aecbe6", "#8fb3d4", "#7099c2"],
      partCloud:  ["#dde5ec", "#b6c5d6", "#94a8c0", "#7990ad"],
      overcast:   ["#dadfe4", "#bcc4cd", "#a0aab6", "#8892a0"],
      fog:        ["#e6e8ea", "#d2d6da", "#bdc2c7", "#a8aeb4"],
      rainLight:  ["#c8d3df", "#a8b6c6", "#8a9aac", "#728294"],
      rain:       ["#aab6c4", "#8b97a7", "#717d8d", "#5a6776"],
      snowLight:  ["#e3eaf1", "#cdd7e1", "#b3bfcb", "#9aa6b3"],
      snow:       ["#dee5ec", "#c6cfd9", "#aab5c0", "#8e98a4"],
      storm:      ["#9aa3ad", "#7a8390", "#5e6776", "#454d5a"],
    }[kind] || ["#cfe4f5", "#a9cdec", "#88b6dd", "#6f9fcf"];

    const night = {
      clear:     ["#0b1326", "#0e1a36", "#13234a", "#1a2c5e"],
      fewClouds: ["#10182a", "#152040", "#1a2a55", "#22356b"],
      partCloud: ["#141a2a", "#1c243a", "#262f4a", "#30395a"],
      overcast:  ["#1a1f2a", "#232936", "#2c3340", "#363d4c"],
      fog:       ["#1f242c", "#282d36", "#323742", "#3c424e"],
      rainLight: ["#141a26", "#1c2230", "#262d3c", "#323a4c"],
      rain:      ["#10141d", "#171c28", "#202635", "#2a3142"],
      snowLight: ["#1a212e", "#222a39", "#2d3646", "#3a4456"],
      snow:      ["#1d242f", "#262e3a", "#313a48", "#3e4856"],
      storm:     ["#0a0d14", "#10141e", "#181d2a", "#222838"],
    }[kind] || ["#0b1326", "#0e1a36", "#13234a", "#1a2c5e"];

    let [top, mid, low, bot] = isDay
      ? (goldenHour ? ["#f5d6b3", "#e8a98a", "#a98aa6", "#5a6f9a"] : daySky)
      : night;

    if (typeof tempC === "number") {
      if (tempC <= 0)  bot = mixHex(bot, "#a8c7e0", 0.25);
      if (tempC >= 28) bot = mixHex(bot, "#e8c39a", 0.25);
    }

    const sunCore =
      goldenHour ? "rgba(255, 210, 160, 0.95)" :
      isDay      ? "rgba(255, 250, 230, 0.95)" :
                   "rgba(230, 235, 255, 0.85)";

    const sunBloom =
      goldenHour ? "rgba(255, 180, 140, 0.45)" :
      isDay      ? "rgba(255, 230, 190, 0.35)" :
                   "rgba(200, 215, 255, 0.18)";

    let flareOp = 1;
    if (!isDay)              flareOp = 0.85;
    if (kind === "overcast") flareOp = 0.25;
    if (kind === "rain")     flareOp = 0.15;
    if (kind === "storm")    flareOp = 0.1;
    if (kind === "fog")      flareOp = 0.2;
    if (kind === "snow")     flareOp = 0.45;
    if (alt < 0.05 && isDay) flareOp *= 0.6;

    const cloudOp = ({
      clear: 0, fewClouds: 0.35, partCloud: 0.6, overcast: 0.85,
      fog: 0.7, rainLight: 0.55, rain: 0.75, snowLight: 0.5, snow: 0.7, storm: 0.9,
    })[kind] ?? 0;

    return {
      "--sky-top": top,
      "--sky-mid": mid,
      "--sky-low": low,
      "--sky-bot": bot,
      "--sun-x": sun.x.toFixed(1) + "%",
      "--sun-y": sun.y.toFixed(1) + "%",
      "--sun-core": sunCore,
      "--sun-bloom": sunBloom,
      "--counter-glow": isDay ? "rgba(180, 210, 240, 0.45)" : "rgba(60, 80, 120, 0.35)",
      "--flare-opacity": String(flareOp),
      "--cloud-opacity": String(cloudOp),
      "--star-opacity": String(isDay ? 0 : (kind === "clear" || kind === "fewClouds" ? 0.95 : 0.4)),
      _isDay: isDay,
      _kind: kind,
    };
  }

  function applyPalette(p) {
    const root = document.documentElement;
    for (const k of Object.keys(p)) {
      if (k.startsWith("--")) root.style.setProperty(k, p[k]);
    }
  }

  function renderStars() {
    const layer = document.getElementById("sky-stars");
    layer.innerHTML = "";
    for (let i = 0; i < 90; i++) {
      const s = document.createElement("div");
      s.className = "sky-star";
      s.style.left = Math.random() * 100 + "%";
      s.style.top  = Math.random() * 80 + "%";
      const size = Math.random() < 0.15 ? 3 : (Math.random() < 0.5 ? 2 : 1);
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.setProperty("--tw", (3 + Math.random() * 5).toFixed(2) + "s");
      s.style.animationDelay = (Math.random() * 5).toFixed(2) + "s";
      layer.appendChild(s);
    }
  }

  function renderPrecip(kind) {
    const layer = document.getElementById("sky-precip");
    layer.innerHTML = "";
    let drops = 0, flakes = 0;
    if (kind === "rainLight") drops = 50;
    if (kind === "rain")      drops = 140;
    if (kind === "storm")     drops = 200;
    if (kind === "snowLight") flakes = 40;
    if (kind === "snow")      flakes = 120;

    for (let i = 0; i < drops; i++) {
      const d = document.createElement("div");
      d.className = "sky-drop";
      d.style.left = Math.random() * 100 + "%";
      d.style.height = (40 + Math.random() * 60) + "px";
      d.style.animationDuration = (0.6 + Math.random() * 0.8).toFixed(2) + "s";
      d.style.animationDelay = (-Math.random() * 1.5).toFixed(2) + "s";
      d.style.opacity = (0.3 + Math.random() * 0.5).toFixed(2);
      layer.appendChild(d);
    }
    for (let i = 0; i < flakes; i++) {
      const f = document.createElement("div");
      f.className = "sky-flake";
      f.style.left = Math.random() * 100 + "%";
      const size = 2 + Math.random() * 4;
      f.style.width = size + "px";
      f.style.height = size + "px";
      f.style.animationDuration = (6 + Math.random() * 8).toFixed(2) + "s";
      f.style.animationDelay = (-Math.random() * 8).toFixed(2) + "s";
      f.style.opacity = (0.4 + Math.random() * 0.5).toFixed(2);
      layer.appendChild(f);
    }
  }

  async function run() {
    // IP-based geolocation — no permission prompt
    let loc;
    try {
      const r = await fetch("https://ipapi.co/json/");
      if (!r.ok) throw new Error("ip lookup failed");
      const j = await r.json();
      if (!j.latitude || !j.longitude) throw new Error("no coords");
      loc = { lat: j.latitude, lon: j.longitude };
    } catch {
      // Fallback coords (New York) if IP lookup fails
      loc = { lat: 40.7128, lon: -74.006 };
    }

    let weather = null;
    try {
      const url = `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${loc.lat}&longitude=${loc.lon}` +
        `&current=temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
        `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`;
      const r = await fetch(url);
      if (r.ok) weather = await r.json();
    } catch {}

    const sun = sunPos(loc.lat, loc.lon);
    let kind = "clear";

    if (weather) {
      const c = weather.current;
      if (typeof c.is_day === "number") sun.isDay = !!c.is_day;
      kind = (WMO[c.weather_code] || {}).kind || "clear";
      applyPalette(palette({ kind, tempC: c.temperature_2m, sun }));
    } else {
      applyPalette(palette({ kind: "clear", tempC: 18, sun }));
    }

    renderStars();
    renderPrecip(kind);
  }

  run().catch(() => {});
})();
