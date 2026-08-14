// Mantém referência de qual áudio está tocando no momento. Sempre que um
// novo áudio começa a tocar, pausa automaticamente o anterior (se houver),
// pra nunca tocar dois ao mesmo tempo em toda a página.
let currentAudioEl = null;
let currentStopCallback = null;

export function registerAudioPlayback(audioEl, onForcedStop) {
  if (currentAudioEl && currentAudioEl !== audioEl) {
    currentAudioEl.pause();
    currentStopCallback?.();
  }
  currentAudioEl = audioEl;
  currentStopCallback = onForcedStop;
}

export function clearAudioPlayback(audioEl) {
  if (currentAudioEl === audioEl) {
    currentAudioEl = null;
    currentStopCallback = null;
  }
}
