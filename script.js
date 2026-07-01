/* ============================================================
   Weather App — script.js
   Uses the OpenWeatherMap REST API (Current Weather + 5 Day/3 Hour Forecast)
   Get a free key at https://openweathermap.org/api
   ============================================================ */

const API_KEY = "f3107fe9d0157593197e8036fdcdbd3f"; // <-- put your key here
const BASE_URL = "https://api.openweathermap.org/data/2.5";

const els = {
  searchForm: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  geoBtn: document.getElementById("geoBtn"),
  unitToggle: document.getElementById("unitToggle"),
  loading: document.getElementById("loadingState"),
  error: document.getElementById("errorState"),
  errorDetail: document.getElementById("errorDetail"),
  weather: document.getElementById("weatherState"),
  cityName: document.getElementById("cityName"),
  dateLine: document.getElementById("dateLine"),
  tempValue: document.getElementById("tempValue"),
  conditionText: document.getElementById("conditionText"),
  feelsLike: document.getElementById("feelsLike"),
  hiLow: document.getElementById("hiLow"),
  statWind: document.getElementById("statWind"),
  statHumidity: document.getElementById("statHumidity"),
  statPressure: document.getElementById("statPressure"),
  statVisibility: document.getElementById("statVisibility"),
  statSunrise: document.getElementById("statSunrise"),
  statSunset: document.getElementById("statSunset"),
  forecastStrip: document.getElementById("forecastStrip"),
  updatedAt: document.getElementById("updatedAt"),
};

// ---- App state ----
let unit = "imperial"; // "imperial" = °F, "metric" = °C
let lastQuery = { type: "city", value: "New York" }; // remembers last successful lookup for unit toggling

// ============================================================
// View state helpers
// ============================================================

function showState(name) {
  els.loading.classList.toggle("hidden", name !== "loading");
  els.error.classList.toggle("hidden", name !== "error");
  els.weather.classList.toggle("hidden", name !== "weather");
}

// ============================================================
// Fetch helpers (async/await + fetch API)
// ============================================================

async function fetchCurrentWeatherByCity(city) {
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${unit}&appid=${API_KEY}`;
  return fetchJSON(url);
}

async function fetchForecastByCity(city) {
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${unit}&appid=${API_KEY}`;
  return fetchJSON(url);
}

async function fetchCurrentWeatherByCoords(lat, lon) {
  const url = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`;
  return fetchJSON(url);
}

async function fetchForecastByCoords(lat, lon) {
  const url = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`;
  return fetchJSON(url);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

// ============================================================
// Core load flow
// ============================================================

async function loadByCity(city) {
  showState("loading");
  try {
    const [current, forecast] = await Promise.all([
      fetchCurrentWeatherByCity(city),
      fetchForecastByCity(city),
    ]);
    lastQuery = { type: "city", value: city };
    render(current, forecast);
    showState("weather");
  } catch (err) {
    showError(err);
  }
}

async function loadByCoords(lat, lon) {
  showState("loading");
  try {
    const [current, forecast] = await Promise.all([
      fetchCurrentWeatherByCoords(lat, lon),
      fetchForecastByCoords(lat, lon),
    ]);
    lastQuery = { type: "coords", value: { lat, lon } };
    render(current, forecast);
    showState("weather");
  } catch (err) {
    showError(err);
  }
}

async function reload() {
  if (lastQuery.type === "city") {
    await loadByCity(lastQuery.value);
  } else {
    await loadByCoords(lastQuery.value.lat, lastQuery.value.lon);
  }
}

function showError(err) {
  els.errorDetail.textContent =
    err.message && err.message !== "city not found"
      ? "Something went wrong fetching that forecast. Try again in a moment."
      : "Check the spelling, or try a nearby city.";
  showState("error");
}

// ============================================================
// Rendering
// ============================================================

function render(current, forecast) {
  const unitLabel = unit === "imperial" ? "°F" : "°C";
  const speedLabel = unit === "imperial" ? "mph" : "m/s";

  els.cityName.textContent = `${current.name}${current.sys?.country ? ", " + current.sys.country : ""}`;
  els.dateLine.textContent = formatDate(new Date());

  els.tempValue.textContent = Math.round(current.main.temp);
  els.conditionText.textContent = capitalize(current.weather[0].description);
  els.feelsLike.textContent = `Feels like ${Math.round(current.main.feels_like)}${unitLabel}`;
  els.hiLow.textContent = `H: ${Math.round(current.main.temp_max)}${unitLabel}   L: ${Math.round(current.main.temp_min)}${unitLabel}`;

  els.statWind.textContent = `${Math.round(current.wind.speed)} ${speedLabel}`;
  els.statHumidity.textContent = `${current.main.humidity}%`;
  els.statPressure.textContent = `${current.main.pressure} hPa`;
  els.statVisibility.textContent = current.visibility != null ? `${(current.visibility / 1000).toFixed(1)} km` : "—";
  els.statSunrise.textContent = formatTime(current.sys.sunrise, current.timezone);
  els.statSunset.textContent = formatTime(current.sys.sunset, current.timezone);

  renderForecast(forecast, unitLabel);
  applySkyTheme(current.weather[0], isDaytime(current));

  els.updatedAt.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function renderForecast(forecast, unitLabel) {
  // Group the 3-hour entries into days, take the midday-ish entry as representative,
  // and compute true daily highs/lows from all entries in that day.
  const byDay = new Map();

  forecast.list.forEach((entry) => {
    const date = new Date(entry.dt * 1000);
    const key = date.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(entry);
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const days = Array.from(byDay.entries())
    .filter(([key]) => key !== todayKey)
    .slice(0, 5);

  els.forecastStrip.innerHTML = "";

  days.forEach(([key, entries]) => {
    const highs = entries.map((e) => e.main.temp_max);
    const lows = entries.map((e) => e.main.temp_min);
    const high = Math.round(Math.max(...highs));
    const low = Math.round(Math.min(...lows));

    // pick entry closest to midday as representative icon/condition
    const rep = entries.reduce((best, e) => {
      const h = new Date(e.dt * 1000).getHours();
      const bestH = new Date(best.dt * 1000).getHours();
      return Math.abs(h - 13) < Math.abs(bestH - 13) ? e : best;
    });

    const card = document.createElement("div");
    card.className = "day-card";
    card.innerHTML = `
      <span class="dname">${new Date(key).toLocaleDateString([], { weekday: "short" })}</span>
      ${weatherIcon(rep.weather[0], true)}
      <span class="drange"><span class="hi">${high}°</span><span class="lo">${low}°</span></span>
    `;
    els.forecastStrip.appendChild(card);
  });
}

function isDaytime(current) {
  const now = current.dt;
  return now > current.sys.sunrise && now < current.sys.sunset;
}

function formatDate(d) {
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(unixSeconds, tzOffsetSeconds) {
  const d = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================
// Weather icon set (inline SVG, theme-matched, no external assets)
// ============================================================

function weatherIcon(weather, small) {
  const id = weather.id;
  const size = small ? 30 : 64;
  const stroke = "currentColor";
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;

  if (id >= 200 && id < 300) {
    // thunderstorm
    return `<svg ${common}><path d="M6 16a4 4 0 0 1 .9-7.9A5 5 0 0 1 16.7 9 4 4 0 0 1 17 17H7a3 3 0 0 1-1-1z"/><path d="M13 11l-2 4h3l-2 4"/></svg>`;
  }
  if (id >= 300 && id < 400) {
    // drizzle
    return `<svg ${common}><path d="M7 15a4 4 0 0 1 .9-7.9A5 5 0 0 1 17.7 8 4 4 0 0 1 18 16H8a3 3 0 0 1-1-1z"/><path d="M9 19v1M13 19v1M17 19v1"/></svg>`;
  }
  if (id >= 500 && id < 600) {
    // rain
    return `<svg ${common}><path d="M6 15a4 4 0 0 1 .9-7.9A5 5 0 0 1 16.7 8 4 4 0 0 1 17 16H7a3 3 0 0 1-1-1z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></svg>`;
  }
  if (id >= 600 && id < 700) {
    // snow
    return `<svg ${common}><path d="M6 14a4 4 0 0 1 .9-7.9A5 5 0 0 1 16.7 7 4 4 0 0 1 17 15H7a3 3 0 0 1-1-1z"/><path d="M9 18v3M9 18l-1.5 1M9 18l1.5 1M15 18v3M15 18l-1.5 1M15 18l1.5 1"/></svg>`;
  }
  if (id >= 700 && id < 800) {
    // atmosphere (mist/fog/haze)
    return `<svg ${common}><path d="M3 9h18M5 13h14M3 17h18"/></svg>`;
  }
  if (id === 800) {
    // clear
    return `<svg ${common}><circle cx="12" cy="12" r="4.5"/><path d="M12 3v2.5M12 18.5V21M4.2 4.2l1.8 1.8M18 18l1.8 1.8M3 12h2.5M18.5 12H21M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>`;
  }
  if (id === 801 || id === 802) {
    // few/scattered clouds
    return `<svg ${common}><circle cx="9" cy="10" r="3.2"/><path d="M8 16a4 4 0 0 1 .8-7.9 5 5 0 0 1 9 1.4A4 4 0 0 1 17 17H9a3 3 0 0 1-1-1z"/></svg>`;
  }
  // 803/804 broken/overcast
  return `<svg ${common}><path d="M6 16a4 4 0 0 1 .9-7.9A5 5 0 0 1 16.7 9 4 4 0 0 1 17 17H7a3 3 0 0 1-1-1z"/></svg>`;
}

// ============================================================
// Sky theme — sets CSS variables + drives the canvas particle layer
// ============================================================

const THEMES = {
  clearDay: { a: "#5aa7e8", b: "#3d7bc4", c: "#1d3a63", particles: "none" },
  clearNight: { a: "#1a1b3a", b: "#11132b", c: "#070815", particles: "stars" },
  cloudsDay: { a: "#8fa3b8", b: "#5c6f87", c: "#33404f", particles: "clouds" },
  cloudsNight: { a: "#262b42", b: "#181c2e", c: "#0a0c16", particles: "clouds" },
  rain: { a: "#4a5568", b: "#323d4e", c: "#181f29", particles: "rain" },
  storm: { a: "#3a3f51", b: "#23273a", c: "#0e1018", particles: "rain" },
  snow: { a: "#c8d3de", b: "#8fa0b3", c: "#4a5566", particles: "snow" },
  mist: { a: "#9aa3a8", b: "#6e787e", c: "#404850", particles: "clouds" },
};

function pickTheme(weather, daytime) {
  const id = weather.id;
  if (id >= 200 && id < 300) return THEMES.storm;
  if (id >= 300 && id < 600) return THEMES.rain;
  if (id >= 600 && id < 700) return THEMES.snow;
  if (id >= 700 && id < 800) return THEMES.mist;
  if (id === 800) return daytime ? THEMES.clearDay : THEMES.clearNight;
  return daytime ? THEMES.cloudsDay : THEMES.cloudsNight;
}

function applySkyTheme(weather, daytime) {
  const theme = pickTheme(weather, daytime);
  document.documentElement.style.setProperty("--sky-a", theme.a);
  document.documentElement.style.setProperty("--sky-b", theme.b);
  document.documentElement.style.setProperty("--sky-c", theme.c);
  setParticleMode(theme.particles);
}

// ============================================================
// Canvas particle background
// ============================================================

const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");
let particles = [];
let mode = "none";
let rafId = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function setParticleMode(newMode) {
  mode = newMode;
  particles = buildParticles(newMode);
  if (!rafId) animate();
}

function buildParticles(m) {
  const w = canvas.width, h = canvas.height;
  const count =
    m === "rain" ? 140 :
      m === "snow" ? 90 :
        m === "stars" ? 120 :
          m === "clouds" ? 6 : 0;

  const arr = [];
  for (let i = 0; i < count; i++) {
    if (m === "rain") {
      arr.push({ x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 14, speed: 7 + Math.random() * 6, drift: -1.5 });
    } else if (m === "snow") {
      arr.push({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.5, speed: 0.6 + Math.random() * 1.4, drift: Math.random() * 0.6 - 0.3, sway: Math.random() * Math.PI * 2 });
    } else if (m === "stars") {
      arr.push({ x: Math.random() * w, y: Math.random() * h * 0.7, r: 0.5 + Math.random() * 1.4, phase: Math.random() * Math.PI * 2 });
    } else if (m === "clouds") {
      arr.push({ x: Math.random() * w, y: h * 0.08 + Math.random() * h * 0.25, scale: 0.6 + Math.random() * 1.1, speed: 0.15 + Math.random() * 0.25 });
    }
  }
  return arr;
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width, h = canvas.height;

  if (mode === "rain") {
    ctx.strokeStyle = "rgba(220, 230, 245, 0.35)";
    ctx.lineWidth = 1.2;
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.drift, p.y + p.len);
      ctx.stroke();
      p.y += p.speed;
      p.x += p.drift * 0.3;
      if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
    });
  } else if (mode === "snow") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    particles.forEach((p) => {
      p.sway += 0.02;
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(p.sway) * 8, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.speed;
      if (p.y > h) { p.y = -4; p.x = Math.random() * w; }
    });
  } else if (mode === "stars") {
    particles.forEach((p) => {
      p.phase += 0.02;
      const tw = 0.4 + Math.abs(Math.sin(p.phase)) * 0.6;
      ctx.fillStyle = `rgba(255,255,255,${tw})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (mode === "clouds") {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    particles.forEach((p) => {
      drawCloud(p.x, p.y, p.scale);
      p.x += p.speed;
      if (p.x > w + 120) p.x = -120;
    });
  }

  rafId = requestAnimationFrame(animate);
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.ellipse(x, y, 50 * scale, 22 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 35 * scale, y + 6 * scale, 36 * scale, 18 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 35 * scale, y + 8 * scale, 32 * scale, 16 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================
// Event wiring
// ============================================================

els.searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = els.cityInput.value.trim();
  if (!city) return;
  loadByCity(city);
});

els.geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError(new Error("Geolocation isn't supported on this browser."));
    return;
  }
  showState("loading");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showError(new Error("Location access was denied."))
  );
});

els.unitToggle.addEventListener("click", async () => {
  unit = unit === "imperial" ? "metric" : "imperial";
  els.unitToggle.textContent = unit === "imperial" ? "°F" : "°C";
  await reload();
});

// ============================================================
// Initial load — try the user's location first, fall back to
// the default city if permission is denied or unavailable.
// ============================================================

function init() {
  if (!navigator.geolocation) {
    loadByCity(lastQuery.value);
    return;
  }

  showState("loading");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadByCoords(pos.coords.latitude, pos.coords.longitude),
    () => loadByCity(lastQuery.value), // denied / timed out / unavailable
    { timeout: 8000 }
  );
}

init();