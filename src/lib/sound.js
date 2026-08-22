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

// Toque de chamada: dois tons mais graves e mais longos que o "ding" de
// mensagem, repetindo em loop - bem diferente do som de notificação normal,
// pra dar pra distinguir "chegou mensagem" de "tem alguém ligando".
function scheduleRingBurst(ctx) {
  const now = ctx.currentTime;

  function tone(freq, start, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.25, now + start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  }

  tone(523.25, 0, 0.35); // Dó
  tone(659.25, 0.4, 0.35); // Mi
}

// Começa a tocar o toque de chamada em loop (repete a cada 1.6s) e devolve
// uma função pra parar. Usado enquanto a chamada está "chamando" ou
// "tocando" (ringing) - para assim que atende, recusa ou cancela.
export function startRingtone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return () => {};

    const begin = () => scheduleRingBurst(ctx);

    if (ctx.state === "suspended") {
      ctx.resume().then(begin).catch(() => {});
    } else {
      begin();
    }

    const interval = setInterval(() => {
      if (ctx.state !== "suspended") scheduleRingBurst(ctx);
    }, 1600);

    return () => clearInterval(interval);
  } catch (err) {
    console.error("Não foi possível tocar o toque de chamada:", err);
    return () => {};
  }
}

// Fanfarra curta de "chamado pra batalha" - toca quando um desafio de jogo
// é enviado/chega, tipo o toque de início de partida de jogos de estratégia
// (só que sintetizado aqui, sem depender de nenhum arquivo de áudio).
function scheduleBattleFanfare(ctx) {
  const now = ctx.currentTime;

  function stab(freq, start, duration, type, peak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(peak, now + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  }

  // Três toques de corneta subindo, com um grave de apoio embaixo do
  // último - dá aquele clima de "começou o desafio".
  stab(392.0, 0, 0.14, "sawtooth", 0.2); // Sol
  stab(523.25, 0.12, 0.14, "sawtooth", 0.2); // Dó
  stab(659.25, 0.24, 0.26, "sawtooth", 0.22); // Mi (segura mais)
  stab(196.0, 0.24, 0.3, "triangle", 0.26); // grave junto do Mi final
}

export function playBattleCall() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().then(() => scheduleBattleFanfare(ctx)).catch(() => {});
    } else {
      scheduleBattleFanfare(ctx);
    }
  } catch (err) {
    console.error("Não foi possível tocar o som de desafio:", err);
  }
}
