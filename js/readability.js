// js/readability.js
const KEY = 'mh_readability_v1';

function readState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function apply(state) {
  const root = document.documentElement;
  const body = document.body;

  const scale = Math.min(2.0, Math.max(0.75, state.scale ?? 1));   // 0.75x - 2.0x
  const spacingOn = !!state.spacing;
  const hcOn = !!state.hc;
  const dysOn = !!state.dys;

  root.style.setProperty('--font-scale', scale.toString());
  root.style.setProperty('--line-space', spacingOn ? '1.8' : '1.5');

  body.classList.toggle('hc',  hcOn);
  body.classList.toggle('dys', dysOn);
}

export function initReadability() {
  const state = { scale: 1, spacing: false, hc: false, dys: false, ...readState() };
  apply(state);

  const el = document.getElementById('readability-widget');
  if (!el) return;

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'increase') state.scale = Math.min(2.0, (state.scale ?? 1) + 0.1);
    if (action === 'decrease') state.scale = Math.max(0.75, (state.scale ?? 1) - 0.1);
    if (action === 'spacing')  state.spacing = !state.spacing;
    if (action === 'contrast') state.hc = !state.hc;
    if (action === 'dyslexic') state.dys = !state.dys;
    if (action === 'reset')    Object.assign(state, { scale: 1, spacing: false, hc: false, dys: false });

    apply(state);
    saveState(state);
  });
}
