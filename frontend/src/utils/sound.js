// Small synthetic notification tones via the Web Audio API — no audio
// files to host/bundle, works offline in the PWA too. Browsers block audio
// before any user interaction on the page, so the very first tone after a
// fresh load may be silently skipped; it'll work after any tap.

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

function beep(freq, startTime, duration, volume = 0.25) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// New order arrived — short, attention-grabbing double-beep (higher pitch).
export function playNewOrderTone() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    beep(880, now, 0.15);
    beep(880, now + 0.2, 0.15);
  } catch (e) { /* audio not available — ignore */ }
}

// Order marked ready — single, calmer chime (lower pitch).
export function playReadyTone() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    beep(523, now, 0.12);
    beep(659, now + 0.13, 0.18);
  } catch (e) { /* audio not available — ignore */ }
}
