/**
 * Sonidos suaves de la app (Web Audio API, sin archivos externos).
 * Mismo patrón que el cajita musical de OpenWhen: AudioContext perezoso,
 * osciladores seno/triángulo con envolventes de ganancia suaves.
 * Si el navegador bloquea el audio (autoplay sin interacción previa),
 * simplemente no suena — nunca rompe el flujo.
 */

let audioCtx = null;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** Nota suave: seno + armónico triángulo con envolvente de caída lenta. */
function softNote(ctx, dest, freq, start, dur, peak) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const harmonic = ctx.createOscillator();
  harmonic.type = 'triangle';
  harmonic.frequency.value = freq * 2.01; // ligero desfase para calidez
  const gain = ctx.createGain();
  const harmonicGain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  harmonicGain.gain.setValueAtTime(0.0001, start);
  harmonicGain.gain.linearRampToValueAtTime(peak * 0.28, start + 0.012);
  harmonicGain.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.85);
  osc.connect(gain).connect(dest);
  harmonic.connect(harmonicGain).connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.05);
  harmonic.start(start);
  harmonic.stop(start + dur + 0.05);
}

const VARIANTS = {
  // "ding-dong" suave y ascendente: invitación a jugar
  invite: { notes: [659.25, 783.99, 987.77], dur: 1.1, gap: 0.16, peak: 0.11 },
  // Dos notas envolventes más bajas: petición de revancha
  rematch: { notes: [523.25, 659.25, 783.99], dur: 1.1, gap: 0.16, peak: 0.11 },
  // Nota simple y cálida: escuchar juntos
  listen: { notes: [440, 554.37, 659.25], dur: 1.1, gap: 0.16, peak: 0.11 }
};

/**
 * Reproduce un chime suave. `variant`: 'invite' | 'rematch' | 'listen'.
 */
export function playInviteChime(variant = 'invite') {
  const ctx = ensureCtx();
  if (!ctx || ctx.state === 'suspended') return;
  const spec = VARIANTS[variant] || VARIANTS.invite;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  const start = ctx.currentTime + 0.02;
  spec.notes.forEach((freq, i) => {
    softNote(ctx, master, freq, start + i * spec.gap, spec.dur, spec.peak);
  });
}
