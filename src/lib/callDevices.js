"use client";

// Guarda qual microfone e qual alto-falante a pessoa prefere usar nas
// chamadas - fica salvo só neste navegador/dispositivo.
const MIC_KEY = "call-preferred-mic";
const SPEAKER_KEY = "call-preferred-speaker";

export function getPreferredMic() {
  try {
    return localStorage.getItem(MIC_KEY) || "";
  } catch {
    return "";
  }
}

export function setPreferredMic(deviceId) {
  try {
    localStorage.setItem(MIC_KEY, deviceId || "");
  } catch {
    // localStorage indisponível - ignora
  }
}

export function getPreferredSpeaker() {
  try {
    return localStorage.getItem(SPEAKER_KEY) || "";
  } catch {
    return "";
  }
}

export function setPreferredSpeaker(deviceId) {
  try {
    localStorage.setItem(SPEAKER_KEY, deviceId || "");
  } catch {
    // localStorage indisponível - ignora
  }
}

// Monta as constraints de áudio pro getUserMedia já com o microfone
// preferido (se ainda existir/estiver conectado).
//
// Cancelamento de eco, redução de ruído e controle automático de ganho
// ficam desligados de propósito: esses recursos "cortam" ou abafam parte
// do som captado pelo microfone (é assim que eles funcionam - filtram o
// que julgam ser eco/ruído). Desligando os três, o microfone capta o
// áudio ao redor sem esse corte.
export function buildAudioConstraints() {
  const deviceId = getPreferredMic();
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: 48000,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

// Constraints da câmera na chamada de vídeo - câmera frontal, enquadramento
// horizontal (16:9) e resolução moderada (suficiente pra chamada, sem pesar
// demais na rede). O aspectRatio pede explicitamente um quadro na horizontal
// pro navegador, em vez de deixar a câmera decidir sozinha.
export function buildVideoConstraints() {
  return {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    aspectRatio: { ideal: 16 / 9 },
  };
}
