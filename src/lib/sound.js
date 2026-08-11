// Toca um "ding" curto usando a Web Audio API, sem precisar hospedar
// nenhum arquivo de áudio. Os navegadores só deixam tocar som depois de
// alguma interação do usuário na página (política de autoplay) - como o
// usuário já precisou clicar em algo pra estar logado, isso não costuma
// ser um problema na prática.
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
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

    setTimeout(() => ctx.close(), 600);
  } catch (err) {
    console.error("Não foi possível tocar o som de notificação:", err);
  }
}
