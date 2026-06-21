// Small synthetic notification tones via the Web Audio API — no audio
// files to host/bundle, works offline in the PWA too.
//
// IMPORTANT limitations to know about:
// 1. Browsers suspend the AudioContext until there's been a user gesture
//    (tap/click) on the page. We explicitly call resume() before every
//    tone to recover from that — but the very first tone right after a
//    cold page load may still be silently skipped.
// 2. This is polling-based, not a real push notification: the tone can
//    only play while this page is actually open and actively polling. If
//    the phone is locked, the app is backgrounded, or a different page is
//    open, no JS is running here and nothing can play. True "notify even
//    when closed" needs Web Push (a separate, bigger feature).

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

function beep(audioCtx, freq, startTime, duration, volume) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'square'; // brighter/louder-sounding than sine at the same volume
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function ensureRunning(audioCtx) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => { /* ignore — still blocked until a tap happens */ });
  }
}

// Call once on the very first tap/click anywhere in the app (see
// main.jsx) — creates+resumes the AudioContext immediately while we have
// a real user gesture, instead of waiting for the first notification to
// try (and possibly fail) to do it.
export function unlockAudio() {
  const audioCtx = getCtx();
  if (audioCtx) ensureRunning(audioCtx);
}

// New order arrived — loud, attention-grabbing triple-beep.
export function playNewOrderTone() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    ensureRunning(audioCtx);
    const now = audioCtx.currentTime;
    beep(audioCtx, 1000, now, 0.18, 0.6);
    beep(audioCtx, 1000, now + 0.22, 0.18, 0.6);
    beep(audioCtx, 1000, now + 0.44, 0.18, 0.6);
  } catch (e) { /* audio not available — ignore */ }
}

// Order marked ready — loud double-chime, distinct pitch from new-order.
export function playReadyTone() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    ensureRunning(audioCtx);
    const now = audioCtx.currentTime;
    beep(audioCtx, 600, now, 0.16, 0.6);
    beep(audioCtx, 800, now + 0.18, 0.22, 0.6);
  } catch (e) { /* audio not available — ignore */ }
}
