// Toca um "ding" curto usando a Web Audio API, sem precisar hospedar
// nenhum arquivo de áudio.
//
// Os navegadores só deixam o áudio tocar de verdade depois de alguma
// interação direta do usuário na página (política de autoplay). Por isso
// usamos um único AudioContext reaproveitado (em vez de criar um novo a
// cada mensagem) e "destravamos" ele assim que a pessoa clica ou aperta
// alguma tecla pela primeira vez - depois disso, tocar som via
// WebSocket/Realtime funciona normalmente.

let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }

  return audioCtx;
}

// Chamado uma vez a partir de qualquer clique/tecla do usuário na página
// (ver SoundContext) para destravar o áudio nos navegadores mais estritos
// (Safari, principalmente).
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function scheduleChime(ctx) {
  const now = ctx.currentTime;

  function tone(freq, start, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.2, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  }

  // Duas notas curtas, tipo "ding-dong"
  tone(880, 0, 0.15);
  tone(1320, 0.12, 0.2);
}

export function playChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      // Ainda não foi destravado por uma interação - tenta retomar e,
      // se conseguir, toca o som; se não conseguir, desiste silenciosamente
      // (vai funcionar assim que a pessoa clicar em qualquer lugar).
      ctx.resume().then(() => scheduleChime(ctx)).catch(() => {});
    } else {
      scheduleChime(ctx);
    }
  } catch (err) {
    console.error("Não foi possível tocar o som de notificação:", err);
  }
}
