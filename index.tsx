
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`);
  });
}

// Smooth splash progress (matches pre-app loading reference)
const splash = document.getElementById('studo-splash');
const percentEl = document.getElementById('studo-splash-percent');
const statusEl = document.getElementById('studo-splash-status');
const lineEl = document.getElementById('studo-splash-line');

const MIN_VISIBLE_MS = 2600;
const PROGRESS_MS = 4500;
const FADE_MS = 650;

let appMounted = false;

// Ensure at least one paint happens after React render before allowing splash to close
window.requestAnimationFrame(() => {
  appMounted = true;
});

const startTime = window.performance?.now?.() ?? Date.now();

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const renderPercent = (pct: number) => {
  if (!percentEl) return;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  percentEl.textContent = `${clamped}%`;
};

const renderStatus = (pct: number) => {
  if (!statusEl) return;
  if (pct < 25) statusEl.textContent = 'INITIALIZING';
  else if (pct < 55) statusEl.textContent = 'CALIBRATING';
  else if (pct < 85) statusEl.textContent = 'ARCHITECTING';
  else statusEl.textContent = 'LAUNCHING';
};

const renderLine = (t: number) => {
  if (!lineEl) return;
  lineEl.style.transform = `scaleX(${Math.max(0, Math.min(1, t))})`;
};

const tick = () => {
  const now = window.performance?.now?.() ?? Date.now();
  const elapsed = now - startTime;
  const t = Math.max(0, Math.min(1, elapsed / PROGRESS_MS));
  const eased = easeOutCubic(t);
  renderPercent(eased * 100);
  renderStatus(eased * 100);
  renderLine(eased);

  const progressDone = t >= 1;
  const minVisibleDone = elapsed >= MIN_VISIBLE_MS;

  if (!progressDone) {
    window.requestAnimationFrame(tick);
    return;
  }

  // Only hide once the app has mounted and minimum visible time is met
  if (!appMounted || !minVisibleDone) {
    window.requestAnimationFrame(tick);
    return;
  }

  if (splash) {
    splash.classList.add('studo-splash--hidden');
    window.setTimeout(() => {
      splash.remove();

      (window as any).__studoSplashDone = true;
      window.dispatchEvent(new Event('studo_splash_done'));
    }, FADE_MS);
  }
};

// Kick off animation immediately
renderPercent(0);
window.requestAnimationFrame(tick);
