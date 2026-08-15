"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { buildAudioConstraints, getPreferredSpeaker } from "@/lib/callDevices";
import { startRingtone, playChime } from "@/lib/sound";
import { useSound } from "@/context/SoundContext.jsx";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Bitrate máximo do áudio na chamada (em bits/s). O padrão do navegador
// costuma ficar bem baixo (~32kbps); subir pra 64kbps deixa a voz bem mais
// nítida sem pesar quase nada na rede (chamada de voz é um fluxo pequeno).
const AUDIO_MAX_BITRATE = 64000;

// Tempo máximo esperando a outra pessoa atender antes de desistir sozinho.
const RING_TIMEOUT_MS = 45000;

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const CallContext = createContext(null);

// Toda a lógica de chamada de voz 1-a-1 (WebRTC) fica isolada aqui - mas,
// diferente de antes, isso agora vive num único lugar pra conta inteira
// (montado uma vez lá em cima, na página do chat), não dentro da janela de
// uma conversa específica. Por isso:
// - trocar de conversa, ou digitar numa conversa (o que re-renderiza a
//   tela), nunca derruba uma chamada em andamento - a chamada não depende
//   mais de qual conversa está aberta;
// - uma ligação chegando aparece mesmo se a pessoa estiver vendo outra
//   conversa (ou nenhuma) - o app escuta o canal de chamada de TODAS as
//   conversas privadas ao mesmo tempo, não só da que está na tela.
//
// A troca de "quero ligar" / "aceito" / dados de conexão (ICE) acontece por
// um canal de broadcast do Supabase Realtime por conversa - o áudio em si
// (depois que a chamada conecta) vai direto entre os dois navegadores
// (peer-to-peer), não passa pelo servidor.
//
// Limitação conhecida: sem servidor TURN configurado, chamadas entre redes
// muito restritivas (ex: algumas redes corporativas/4G com NAT simétrico)
// podem não conseguir conectar. Cobre a grande maioria das redes domésticas
// e wifi comuns.
export function CallProvider({ user, conversations, children }) {
  const [callState, setCallState] = useState("idle"); // idle | calling | ringing | connected
  const [peerName, setPeerName] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Vídeo/tela na chamada 1-a-1. "Local" é o que EU estou mandando (câmera
  // ou tela); "remote" é o que a outra pessoa está mandando pra mim.
  const [localVideoOn, setLocalVideoOn] = useState(false);
  const [localScreenSharing, setLocalScreenSharing] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState(null);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [remoteVideoStream, setRemoteVideoStream] = useState(null);

  const { enabled: soundEnabled } = useSound();

  // canais de sinalização: um por conversa privada (call-<conversationId>),
  // escutados todos ao mesmo tempo - não só o da conversa aberta.
  const channelsRef = useRef(new Map());
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(typeof Audio !== "undefined" ? new Audio() : null);
  const callIdRef = useRef(null);
  const peerIdRef = useRef(null);
  const conversationIdRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const durationIntervalRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const disconnectGraceRef = useRef(null);
  const stopRingtoneRef = useRef(null);

  // Vídeo 1-a-1: o "slot" de vídeo (RTCRtpSender) é criado junto com a
  // conexão, mesmo numa chamada só de voz - assim ligar a câmera ou
  // compartilhar tela depois não exige renegociar a chamada, só trocar a
  // faixa que está sendo enviada nesse slot (câmera, tela, ou nada).
  const videoSenderRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const videoModeRef = useRef("off"); // "off" | "camera" | "screen"

  // Refs "espelhando" o estado mais recente - os handlers dos canais são
  // criados uma vez (só quando a lista de conversas muda) e não podem
  // depender de closures presas num valor antigo de estado.
  const callStateRef = useRef("idle");
  const isMutedRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const userRef = useRef(user);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ---------- Chamada em GRUPO (mesh WebRTC - todo mundo conecta com todo
  // mundo diretamente, sem servidor central de mídia) ----------
  //
  // Diferente da chamada 1-a-1 (que tem um "ligando/tocando/atendeu"), a
  // chamada em grupo funciona como uma "sala": quem entra primeiro começa a
  // sala, e qualquer outro membro do grupo pode entrar a qualquer momento
  // enquanto ela estiver rolando - não existe um "aceitar/recusar" por
  // pessoa. A lista de quem está na sala é mantida via Presence do Supabase
  // Realtime (cada participante "se marca" como presente no canal da
  // conversa), o que também é o que permite mostrar "chamada em andamento"
  // em qualquer grupo, mesmo pra quem ainda não entrou.
  const [groupCallState, setGroupCallState] = useState("idle"); // idle | active
  const [groupCallConversation, setGroupCallConversation] = useState(null); // {id, name}
  const [groupCallPeers, setGroupCallPeers] = useState([]); // [{id, username, avatarColor, avatarUrl, connected}]
  const [groupIsMuted, setGroupIsMuted] = useState(false);
  const [groupDuration, setGroupDuration] = useState(0);
  // {[conversationId]: {count, names, conversationName}} - permite mostrar um
  // aviso de "chamada em andamento" em QUALQUER grupo, mesmo um que a pessoa
  // não entrou (e nem estava olhando quando a chamada começou).
  const [groupCallBanners, setGroupCallBanners] = useState({});

  // Vídeo/tela na chamada em grupo - assim como no áudio, uma única faixa
  // local (câmera OU tela, nunca as duas) é replicada pra TODAS as conexões
  // da malha de uma vez.
  const [groupLocalVideoOn, setGroupLocalVideoOn] = useState(false);
  const [groupLocalScreenSharing, setGroupLocalScreenSharing] = useState(false);
  const [groupLocalVideoStream, setGroupLocalVideoStream] = useState(null);

  const groupPcsRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const groupAudioElsRef = useRef(new Map()); // peerId -> elemento <audio>
  const groupPendingCandidatesRef = useRef(new Map()); // peerId -> candidatos ICE recebidos cedo demais
  const groupDisconnectTimersRef = useRef(new Map()); // peerId -> timeout de tolerância antes de remover
  const groupLocalStreamRef = useRef(null);
  const groupConversationIdRef = useRef(null);
  const groupDurationIntervalRef = useRef(null);
  const groupCallStateRef = useRef("idle");
  const groupIsMutedRef = useRef(false);

  // peerId -> RTCRtpSender do slot de vídeo daquela conexão específica (uma
  // por peer, já que cada um tem sua própria RTCPeerConnection na malha).
  const groupVideoSendersRef = useRef(new Map());
  const groupLocalVideoTrackRef = useRef(null);
  const groupVideoModeRef = useRef("off"); // "off" | "camera" | "screen"

  function stopRingtone() {
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
  }

  function playRingtoneIfEnabled() {
    stopRingtone();
    if (soundEnabledRef.current) stopRingtoneRef.current = startRingtone();
  }

  // O botão de som (🔔/🔕) controla notificação de mensagem E toque de
  // chamada juntos. Se a pessoa desativa o som enquanto o toque está
  // tocando, ele para na hora; se reativa no meio de uma ligação ainda
  // chamando/tocando, volta a tocar.
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (!soundEnabled) {
      stopRingtone();
    } else if (callStateRef.current === "calling" || callStateRef.current === "ringing") {
      stopRingtone();
      stopRingtoneRef.current = startRingtone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled]);

  function cleanupPeer() {
    stopRingtone();
    clearInterval(durationIntervalRef.current);
    clearTimeout(ringTimeoutRef.current);
    clearTimeout(disconnectGraceRef.current);
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteDescSetRef.current = false;
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;
    callIdRef.current = null;
    peerIdRef.current = null;
    conversationIdRef.current = null;
    setIsMuted(false);
    setDuration(0);
    setConversationId(null);

    localVideoTrackRef.current?.stop();
    localVideoTrackRef.current = null;
    videoSenderRef.current = null;
    videoModeRef.current = "off";
    setLocalVideoOn(false);
    setLocalScreenSharing(false);
    setLocalVideoStream(null);
    setRemoteVideoOn(false);
    setRemoteScreenSharing(false);
    setRemoteVideoStream(null);
  }

  function resetToIdle(message) {
    cleanupPeer();
    setCallState("idle");
    setPeerName("");
    if (message) {
      setStatusMessage(message);
      setTimeout(() => setStatusMessage(""), 3000);
    }
  }

  function send(convId, event, payload) {
    channelsRef.current.get(convId)?.send({
      type: "broadcast",
      event,
      payload: { from: userRef.current.id, ...payload },
    });
  }

  // ---------- Helpers da chamada em grupo ----------

  // Atualiza (ou cria) a entrada de um participante na lista exibida na
  // tela, sem apagar campos que já tinham sido preenchidos antes (ex: já
  // sabíamos o username, e agora só a conexão ficou pronta).
  function upsertGroupPeer(list, patch) {
    const idx = list.findIndex((p) => p.id === patch.id);
    if (idx === -1) {
      return [
        ...list,
        {
          id: patch.id,
          username: "…",
          avatarColor: "blue",
          avatarUrl: null,
          connected: false,
          videoStream: null,
          videoOn: false,
          screenSharing: false,
          ...patch,
        },
      ];
    }
    const next = [...list];
    next[idx] = { ...next[idx], ...patch };
    return next;
  }

  function createGroupPeerConnection(convId, peerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    // Slot de vídeo já criado de cara (mesmo numa chamada só de voz) -
    // ligar câmera/tela depois só troca a faixa desse slot, sem precisar
    // renegociar a conexão com essa pessoa.
    const videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
    groupVideoSendersRef.current.set(peerId, videoTransceiver.sender);
    if (groupLocalVideoTrackRef.current) {
      videoTransceiver.sender.replaceTrack(groupLocalVideoTrackRef.current).catch(() => {});
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send(convId, "group-call-signal", { to: peerId, kind: "ice", candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "video") {
        setGroupCallPeers((prev) => upsertGroupPeer(prev, { id: peerId, videoStream: new MediaStream([e.track]) }));
        return;
      }

      let audioEl = groupAudioElsRef.current.get(peerId);
      if (!audioEl) {
        audioEl = typeof Audio !== "undefined" ? new Audio() : null;
        if (audioEl) groupAudioElsRef.current.set(peerId, audioEl);
      }
      if (audioEl) {
        audioEl.srcObject = e.streams[0];
        const preferredSpeaker = getPreferredSpeaker();
        if (preferredSpeaker && audioEl.setSinkId) {
          audioEl.setSinkId(preferredSpeaker).catch(() => {});
        }
        audioEl.play().catch(() => {});
      }
      setGroupCallPeers((prev) => upsertGroupPeer(prev, { id: peerId, connected: true }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearTimeout(groupDisconnectTimersRef.current.get(peerId));
        groupDisconnectTimersRef.current.delete(peerId);
        setGroupCallPeers((prev) => upsertGroupPeer(prev, { id: peerId, connected: true }));

        // Se eu já estava com câmera/tela ligada, a faixa já foi anexada
        // acima (antes da oferta/resposta) - isso aqui é só pra pessoa que
        // acabou de conectar saber o que é (câmera ou tela) pra rotular
        // certo na tela dela.
        if (groupVideoModeRef.current !== "off") {
          send(convId, "group-call-video-state", {
            to: peerId,
            videoOn: true,
            screenSharing: groupVideoModeRef.current === "screen",
          });
        }
      } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        // Dá uma chance de reconectar sozinho (instabilidade momentânea de
        // rede) antes de tirar essa pessoa da tela de vez.
        clearTimeout(groupDisconnectTimersRef.current.get(peerId));
        groupDisconnectTimersRef.current.set(peerId, setTimeout(() => removeGroupPeer(peerId), 6000));
      }
    };

    return pc;
  }

  async function flushGroupPendingCandidates(peerId) {
    const pc = groupPcsRef.current.get(peerId);
    if (!pc) return;
    const queued = groupPendingCandidatesRef.current.get(peerId) || [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignora candidato inválido/atrasado
      }
    }
    groupPendingCandidatesRef.current.delete(peerId);
  }

  function removeGroupPeer(peerId) {
    groupPcsRef.current.get(peerId)?.close();
    groupPcsRef.current.delete(peerId);
    groupVideoSendersRef.current.delete(peerId);

    const audioEl = groupAudioElsRef.current.get(peerId);
    if (audioEl) audioEl.srcObject = null;
    groupAudioElsRef.current.delete(peerId);

    groupPendingCandidatesRef.current.delete(peerId);
    clearTimeout(groupDisconnectTimersRef.current.get(peerId));
    groupDisconnectTimersRef.current.delete(peerId);

    setGroupCallPeers((prev) => prev.filter((p) => p.id !== peerId));
  }

  // Cria a conexão com um novo participante e manda uma oferta pra ele -
  // usado quando EU sou quem "puxa" a conexão (ver a regra de desempate na
  // sincronização de presença, mais abaixo).
  async function initiateGroupOffer(convId, peerId, meta) {
    const channel = channelsRef.current.get(convId);
    if (!channel || !groupLocalStreamRef.current) return;

    const pc = createGroupPeerConnection(convId, peerId);
    groupPcsRef.current.set(peerId, pc);
    groupLocalStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, groupLocalStreamRef.current));
    await boostAudioBitrate(pc);

    setGroupCallPeers((prev) =>
      upsertGroupPeer(prev, {
        id: peerId,
        username: meta?.username,
        avatarColor: meta?.avatarColor,
        avatarUrl: meta?.avatarUrl,
        connected: false,
      })
    );

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send(convId, "group-call-signal", {
      to: peerId,
      kind: "offer",
      sdp: offer,
      username: userRef.current.username,
      avatarColor: userRef.current.avatarColor,
      avatarUrl: userRef.current.avatarUrl,
    });
  }

  function cleanupGroupCall() {
    clearInterval(groupDurationIntervalRef.current);
    for (const timer of groupDisconnectTimersRef.current.values()) clearTimeout(timer);
    groupDisconnectTimersRef.current.clear();

    for (const pc of groupPcsRef.current.values()) pc.close();
    groupPcsRef.current.clear();
    groupVideoSendersRef.current.clear();

    for (const audioEl of groupAudioElsRef.current.values()) audioEl.srcObject = null;
    groupAudioElsRef.current.clear();

    groupPendingCandidatesRef.current.clear();
    groupLocalStreamRef.current?.getTracks().forEach((t) => t.stop());
    groupLocalStreamRef.current = null;

    groupLocalVideoTrackRef.current?.stop();
    groupLocalVideoTrackRef.current = null;
    groupVideoModeRef.current = "off";
    setGroupLocalVideoOn(false);
    setGroupLocalScreenSharing(false);
    setGroupLocalVideoStream(null);

    groupCallStateRef.current = "idle";
    groupIsMutedRef.current = false;
    groupConversationIdRef.current = null;

    setGroupCallState("idle");
    setGroupCallConversation(null);
    setGroupCallPeers([]);
    setGroupIsMuted(false);
    setGroupDuration(0);
  }

  function createPeerConnection(convId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    // Slot de vídeo já criado de cara (mesmo numa chamada só de voz) -
    // ligar câmera/tela depois só troca a faixa desse slot, sem precisar
    // renegociar a chamada.
    const videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
    videoSenderRef.current = videoTransceiver.sender;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send(convId, "call-ice", { to: peerIdRef.current, callId: callIdRef.current, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "video") {
        setRemoteVideoStream(new MediaStream([e.track]));
        return;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        const preferredSpeaker = getPreferredSpeaker();
        if (preferredSpeaker && remoteAudioRef.current.setSinkId) {
          remoteAudioRef.current.setSinkId(preferredSpeaker).catch(() => {});
        }
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearTimeout(disconnectGraceRef.current);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        // Dá uma chance de reconectar sozinho antes de encerrar de vez -
        // instabilidade momentânea de rede não deveria já derrubar a ligação.
        clearTimeout(disconnectGraceRef.current);
        disconnectGraceRef.current = setTimeout(() => {
          resetToIdle("Chamada caiu (conexão perdida).");
        }, 6000);
      }
    };

    return pc;
  }

  async function flushPendingCandidates() {
    const pc = pcRef.current;
    if (!pc) return;
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignora candidato inválido/atrasado
      }
    }
    pendingCandidatesRef.current = [];
  }

  // Pede pro navegador priorizar mais qualidade de áudio nessa chamada,
  // até o limite de AUDIO_MAX_BITRATE. Nem todo navegador respeita isso
  // (é "melhor esforço"), então falha silenciosamente se não suportar.
  async function boostAudioBitrate(pc) {
    const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0].maxBitrate = AUDIO_MAX_BITRATE;
      await sender.setParameters(params);
    } catch {
      // navegador não suporta ajustar isso - segue com o padrão dele
    }
  }

  // Troca o microfone em uso NO MEIO da chamada, sem precisar desligar e
  // ligar de novo - troca só a faixa de áudio que está sendo enviada.
  const switchMicrophone = useCallback(async (deviceId) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { ...buildAudioConstraints(), deviceId: deviceId ? { exact: deviceId } : undefined },
      });
      const newTrack = newStream.getAudioTracks()[0];
      newTrack.enabled = !isMutedRef.current;

      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) await sender.replaceTrack(newTrack);

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = newStream;
      await boostAudioBitrate(pc);
    } catch (err) {
      console.error("Não foi possível trocar de microfone:", err);
      alert("Não foi possível trocar de microfone.");
    }
  }, []);

  // Troca o dispositivo de saída (alto-falante/fone) - só funciona em
  // navegadores baseados em Chromium; nos outros, o navegador de quem
  // recebe já decide sozinho (ex: Safari sempre usa o padrão do sistema).
  const switchSpeaker = useCallback(async (deviceId) => {
    if (!remoteAudioRef.current?.setSinkId) return;
    try {
      await remoteAudioRef.current.setSinkId(deviceId || "");
    } catch (err) {
      console.error("Não foi possível trocar de alto-falante:", err);
    }
  }, []);

  // Troca a faixa de vídeo enviada (câmera, tela, ou nenhuma) no slot já
  // existente na conexão - não precisa renegociar a chamada pra isso, já
  // que o slot de vídeo é criado desde o início (ver createPeerConnection).
  async function applyLocalVideoTrack(track, screenSharing) {
    const sender = videoSenderRef.current;
    if (sender) {
      try {
        await sender.replaceTrack(track);
      } catch (err) {
        console.error("Não foi possível atualizar o vídeo da chamada:", err);
      }
    }

    const old = localVideoTrackRef.current;
    if (old && old !== track) old.stop();
    localVideoTrackRef.current = track;

    if (track) {
      setLocalVideoStream(new MediaStream([track]));
      setLocalVideoOn(true);
      setLocalScreenSharing(!!screenSharing);
    } else {
      setLocalVideoStream(null);
      setLocalVideoOn(false);
      setLocalScreenSharing(false);
    }

    const convId = conversationIdRef.current;
    if (convId && peerIdRef.current) {
      send(convId, "call-video-state", { to: peerIdRef.current, videoOn: !!track, screenSharing: !!screenSharing });
    }
  }

  // Liga/desliga a câmera durante a chamada. Se a tela estiver sendo
  // compartilhada, ligar a câmera troca pra ela (só um vídeo por vez).
  const toggleVideo = useCallback(async () => {
    if (callStateRef.current !== "connected") return;

    if (videoModeRef.current === "camera") {
      await applyLocalVideoTrack(null, false);
      videoModeRef.current = "off";
      return;
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const track = camStream.getVideoTracks()[0];
      await applyLocalVideoTrack(track, false);
      videoModeRef.current = "camera";
    } catch (err) {
      console.error("Não foi possível acessar a câmera:", err);
      alert("Não foi possível acessar a câmera. Confira as permissões do navegador para esse site.");
    }
  }, []);

  // Liga/desliga o compartilhamento de tela. Detecta sozinho quando a
  // pessoa clica em "Parar apresentação" no controle nativo do navegador.
  const toggleScreenShare = useCallback(async () => {
    if (callStateRef.current !== "connected") return;

    if (videoModeRef.current === "screen") {
      await applyLocalVideoTrack(null, false);
      videoModeRef.current = "off";
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screenStream.getVideoTracks()[0];
      track.onended = () => {
        if (videoModeRef.current === "screen") {
          applyLocalVideoTrack(null, false);
          videoModeRef.current = "off";
        }
      };
      await applyLocalVideoTrack(track, true);
      videoModeRef.current = "screen";
    } catch (err) {
      // "NotAllowedError" é só a pessoa cancelando o seletor - não é erro.
      if (err?.name !== "NotAllowedError") console.error("Não foi possível compartilhar a tela:", err);
    }
  }, []);

  // Liga pra outra pessoa de uma conversa privada específica.
  const startCall = useCallback(async (conversation) => {
    if (!conversation || conversation.isGroup) return;
    if (callStateRef.current !== "idle" || groupCallStateRef.current !== "idle") return;

    const peer = conversation.participants?.[0];
    if (!peer) {
      alert("Não foi possível identificar quem vai receber a ligação.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
      localStreamRef.current = stream;

      const pc = createPeerConnection(conversation.id);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await boostAudioBitrate(pc);

      callIdRef.current = randomId();
      peerIdRef.current = peer.id;
      conversationIdRef.current = conversation.id;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setCallState("calling");
      setPeerName(conversation.name);
      setConversationId(conversation.id);
      send(conversation.id, "call-offer", {
        callId: callIdRef.current,
        sdp: offer,
        fromUsername: userRef.current.username,
      });
      playRingtoneIfEnabled();

      ringTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current !== "connected") {
          send(conversation.id, "call-cancel", { callId: callIdRef.current });
          resetToIdle("Ninguém atendeu.");
        }
      }, RING_TIMEOUT_MS);
    } catch (err) {
      console.error(err);
      alert("Não foi possível acessar o microfone. Confira as permissões do navegador para esse site.");
      cleanupPeer();
      setCallState("idle");
    }
  }, []);

  const acceptCall = useCallback(async () => {
    if (callStateRef.current !== "ringing" || !pendingOfferRef.current) return;
    const convId = conversationIdRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
      localStreamRef.current = stream;

      const pc = createPeerConnection(convId);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await boostAudioBitrate(pc);

      await pc.setRemoteDescription(pendingOfferRef.current.sdp);
      remoteDescSetRef.current = true;
      await flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      send(convId, "call-answer", { to: peerIdRef.current, callId: callIdRef.current, sdp: answer });

      stopRingtone();
      setCallState("connected");
      setDuration(0);
      durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      console.error(err);
      alert("Não foi possível acessar o microfone. Confira as permissões do navegador para esse site.");
      send(convId, "call-reject", { to: peerIdRef.current, callId: callIdRef.current });
      resetToIdle();
    }
  }, []);

  const rejectCall = useCallback(() => {
    if (callStateRef.current !== "ringing") return;
    send(conversationIdRef.current, "call-reject", { to: peerIdRef.current, callId: callIdRef.current });
    resetToIdle();
  }, []);

  const endCall = useCallback(() => {
    if (callStateRef.current === "idle") return;
    send(conversationIdRef.current, "call-end", { to: peerIdRef.current, callId: callIdRef.current });
    resetToIdle();
  }, []);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMutedRef.current;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setIsMuted(nextMuted);
  }, []);

  // Entra na "sala" de chamada em grupo de uma conversa - seja começando
  // ela do zero (ninguém mais lá ainda) ou entrando numa que já está
  // rolando. Os dois casos são o mesmo código: só marcar presença no canal
  // já é suficiente pra sincronizar com quem estiver lá.
  const joinGroupCall = useCallback(async (conversation) => {
    if (!conversation?.isGroup) return;
    if (callStateRef.current !== "idle" || groupCallStateRef.current !== "idle") return;

    const channel = channelsRef.current.get(conversation.id);
    if (!channel) {
      alert("Canal de chamada indisponível - tente novamente em instantes.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
      groupLocalStreamRef.current = stream;
      groupConversationIdRef.current = conversation.id;
      setGroupCallPeers([]);
      setGroupIsMuted(false);
      groupIsMutedRef.current = false;
      setGroupCallConversation({ id: conversation.id, name: conversation.name });

      // Se eu for o primeiro a entrar, avisa o grupo com um toque - quem já
      // estava na sala nem precisa disso (a lista de presença já mostra).
      const alreadyHasSomeoneInCall = Object.values(channel.presenceState())
        .flat()
        .some((p) => p.inCall);

      groupCallStateRef.current = "active";
      setGroupCallState("active");
      setGroupDuration(0);
      groupDurationIntervalRef.current = setInterval(() => setGroupDuration((d) => d + 1), 1000);

      await channel.track({
        inCall: true,
        userId: userRef.current.id,
        username: userRef.current.username,
        avatarColor: userRef.current.avatarColor,
        avatarUrl: userRef.current.avatarUrl,
      });

      if (!alreadyHasSomeoneInCall) {
        send(conversation.id, "group-call-ring", { username: userRef.current.username });
      }
    } catch (err) {
      console.error(err);
      alert("Não foi possível acessar o microfone. Confira as permissões do navegador para esse site.");
      cleanupGroupCall();
    }
  }, []);

  const leaveGroupCall = useCallback(() => {
    if (groupCallStateRef.current === "idle") return;
    channelsRef.current.get(groupConversationIdRef.current)?.untrack();
    cleanupGroupCall();
  }, []);

  const toggleGroupMute = useCallback(() => {
    const stream = groupLocalStreamRef.current;
    if (!stream) return;
    const nextMuted = !groupIsMutedRef.current;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    groupIsMutedRef.current = nextMuted;
    setGroupIsMuted(nextMuted);
  }, []);

  // Troca o microfone em uso em TODAS as conexões da chamada em grupo de
  // uma vez (uma faixa de áudio por peer, já que cada um tem sua própria
  // RTCPeerConnection na topologia mesh).
  const switchGroupMicrophone = useCallback(async (deviceId) => {
    if (!groupLocalStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { ...buildAudioConstraints(), deviceId: deviceId ? { exact: deviceId } : undefined },
      });
      const newTrack = newStream.getAudioTracks()[0];
      newTrack.enabled = !groupIsMutedRef.current;

      for (const pc of groupPcsRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) await sender.replaceTrack(newTrack);
      }

      groupLocalStreamRef.current.getTracks().forEach((t) => t.stop());
      groupLocalStreamRef.current = newStream;

      for (const pc of groupPcsRef.current.values()) {
        await boostAudioBitrate(pc);
      }
    } catch (err) {
      console.error("Não foi possível trocar de microfone:", err);
      alert("Não foi possível trocar de microfone.");
    }
  }, []);

  // Troca o alto-falante em TODOS os elementos de áudio da chamada em
  // grupo (um por participante conectado).
  const switchGroupSpeaker = useCallback(async (deviceId) => {
    const elements = Array.from(groupAudioElsRef.current.values());
    if (elements.length === 0 || !elements[0]?.setSinkId) return;
    for (const el of elements) {
      try {
        await el.setSinkId(deviceId || "");
      } catch (err) {
        console.error("Não foi possível trocar de alto-falante:", err);
      }
    }
  }, []);

  // Troca a faixa de vídeo enviada (câmera, tela, ou nenhuma) em TODAS as
  // conexões da malha de uma vez - cada uma já tem seu próprio slot de
  // vídeo desde que conectou (ver createGroupPeerConnection), então trocar
  // a faixa não derruba nem precisa renegociar nenhuma delas.
  async function applyGroupLocalVideoTrack(track, screenSharing) {
    for (const sender of groupVideoSendersRef.current.values()) {
      try {
        await sender.replaceTrack(track);
      } catch (err) {
        console.error("Não foi possível atualizar o vídeo da chamada:", err);
      }
    }

    const old = groupLocalVideoTrackRef.current;
    if (old && old !== track) old.stop();
    groupLocalVideoTrackRef.current = track;

    if (track) {
      setGroupLocalVideoStream(new MediaStream([track]));
      setGroupLocalVideoOn(true);
      setGroupLocalScreenSharing(!!screenSharing);
    } else {
      setGroupLocalVideoStream(null);
      setGroupLocalVideoOn(false);
      setGroupLocalScreenSharing(false);
    }

    const convId = groupConversationIdRef.current;
    if (convId) {
      send(convId, "group-call-video-state", { videoOn: !!track, screenSharing: !!screenSharing });
    }
  }

  const toggleGroupVideo = useCallback(async () => {
    if (groupCallStateRef.current !== "active") return;

    if (groupVideoModeRef.current === "camera") {
      await applyGroupLocalVideoTrack(null, false);
      groupVideoModeRef.current = "off";
      return;
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const track = camStream.getVideoTracks()[0];
      await applyGroupLocalVideoTrack(track, false);
      groupVideoModeRef.current = "camera";
    } catch (err) {
      console.error("Não foi possível acessar a câmera:", err);
      alert("Não foi possível acessar a câmera. Confira as permissões do navegador para esse site.");
    }
  }, []);

  const toggleGroupScreenShare = useCallback(async () => {
    if (groupCallStateRef.current !== "active") return;

    if (groupVideoModeRef.current === "screen") {
      await applyGroupLocalVideoTrack(null, false);
      groupVideoModeRef.current = "off";
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screenStream.getVideoTracks()[0];
      track.onended = () => {
        if (groupVideoModeRef.current === "screen") {
          applyGroupLocalVideoTrack(null, false);
          groupVideoModeRef.current = "off";
        }
      };
      await applyGroupLocalVideoTrack(track, true);
      groupVideoModeRef.current = "screen";
    } catch (err) {
      if (err?.name !== "NotAllowedError") console.error("Não foi possível compartilhar a tela:", err);
    }
  }, []);

  // Assina o canal de sinalização de TODA conversa da pessoa ao mesmo tempo
  // (não só a que está aberta na tela) - privadas para chamada 1-a-1, e
  // grupos para chamada em grupo + aviso de "chamada em andamento". Reage à
  // lista de conversas mudando, mas só cria/remove canal para o que
  // realmente mudou - a lista chega de novo a cada poll mesmo sem nada ter
  // mudado de fato.
  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    const list = conversations || [];
    const wantedIds = new Set(list.map((c) => c.id));
    const current = channelsRef.current;

    for (const [id, channel] of current) {
      if (!wantedIds.has(id)) {
        supabase.removeChannel(channel);
        current.delete(id);
      }
    }

    list.forEach((conv) => {
      const id = conv.id;
      if (current.has(id)) return;

      // A key de presença é o próprio userId - assim, se a pessoa tiver
      // duas abas abertas, elas dividem a mesma "vaga" de presença em vez
      // de aparecerem como duas pessoas na sala.
      const channel = supabase
        .channel(`call-${id}`, { config: { presence: { key: user.id } } })
        .on("broadcast", { event: "call-offer" }, ({ payload }) => {
          if (payload.from === user.id) return;

          // Se já estiver em outra chamada (1-a-1 ou em grupo), recusa
          // automaticamente (ocupado).
          if (callStateRef.current !== "idle" || groupCallStateRef.current !== "idle") {
            channel.send({
              type: "broadcast",
              event: "call-reject",
              payload: { from: user.id, to: payload.from, callId: payload.callId, busy: true },
            });
            return;
          }

          peerIdRef.current = payload.from;
          callIdRef.current = payload.callId;
          conversationIdRef.current = id;
          pendingOfferRef.current = payload;
          setPeerName(payload.fromUsername || "Alguém");
          setConversationId(id);
          setCallState("ringing");
          navigator.vibrate?.([300, 150, 300]);
          playRingtoneIfEnabled();
        })
        .on("broadcast", { event: "call-answer" }, async ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current) return;
          clearTimeout(ringTimeoutRef.current);
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(payload.sdp);
          remoteDescSetRef.current = true;
          await flushPendingCandidates();
          stopRingtone();
          setCallState("connected");
          setDuration(0);
          durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        })
        .on("broadcast", { event: "call-ice" }, async ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current) return;
          if (remoteDescSetRef.current && pcRef.current) {
            try {
              await pcRef.current.addIceCandidate(payload.candidate);
            } catch {
              // ignora
            }
          } else {
            pendingCandidatesRef.current.push(payload.candidate);
          }
        })
        .on("broadcast", { event: "call-reject" }, ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current) return;
          resetToIdle(payload.busy ? "A pessoa está em outra chamada." : "Chamada recusada.");
        })
        .on("broadcast", { event: "call-cancel" }, ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current) return;
          resetToIdle("Chamada cancelada.");
        })
        .on("broadcast", { event: "call-end" }, ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current) return;
          resetToIdle("Chamada encerrada.");
        })
        .on("broadcast", { event: "call-video-state" }, ({ payload }) => {
          if (payload.from === user.id || payload.to !== user.id) return;
          if (callStateRef.current !== "connected" || conversationIdRef.current !== id) return;
          setRemoteVideoOn(!!payload.videoOn);
          setRemoteScreenSharing(!!payload.screenSharing);
          if (!payload.videoOn) setRemoteVideoStream(null);
        })
        // ---------- Chamada em grupo ----------
        .on("broadcast", { event: "group-call-ring" }, ({ payload }) => {
          if (payload.from === user.id) return;
          // Só um "ding" simples de aviso - o aviso persistente de "chamada
          // em andamento" vem da presença, não deste evento.
          if (soundEnabledRef.current) playChime();
        })
        .on("broadcast", { event: "group-call-video-state" }, ({ payload }) => {
          if (payload.from === user.id) return;
          if (payload.to && payload.to !== user.id) return;
          setGroupCallPeers((prev) =>
            upsertGroupPeer(prev, {
              id: payload.from,
              videoOn: !!payload.videoOn,
              screenSharing: !!payload.screenSharing,
              ...(payload.videoOn ? {} : { videoStream: null }),
            })
          );
        })
        .on("broadcast", { event: "group-call-signal" }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          if (groupCallStateRef.current !== "active" || groupConversationIdRef.current !== id) return;

          if (payload.kind === "offer") {
            let pc = groupPcsRef.current.get(payload.from);
            if (!pc) {
              pc = createGroupPeerConnection(id, payload.from);
              groupPcsRef.current.set(payload.from, pc);
              groupLocalStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, groupLocalStreamRef.current));
              await boostAudioBitrate(pc);
            }
            await pc.setRemoteDescription(payload.sdp);
            await flushGroupPendingCandidates(payload.from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            setGroupCallPeers((prev) =>
              upsertGroupPeer(prev, {
                id: payload.from,
                username: payload.username,
                avatarColor: payload.avatarColor,
                avatarUrl: payload.avatarUrl,
              })
            );
            send(id, "group-call-signal", { to: payload.from, kind: "answer", sdp: answer });
          } else if (payload.kind === "answer") {
            const pc = groupPcsRef.current.get(payload.from);
            if (pc) {
              await pc.setRemoteDescription(payload.sdp);
              await flushGroupPendingCandidates(payload.from);
            }
          } else if (payload.kind === "ice") {
            const pc = groupPcsRef.current.get(payload.from);
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(payload.candidate);
              } catch {
                // ignora
              }
            } else {
              const queued = groupPendingCandidatesRef.current.get(payload.from) || [];
              queued.push(payload.candidate);
              groupPendingCandidatesRef.current.set(payload.from, queued);
            }
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const entries = Object.values(state).flat().filter((p) => p.inCall);

          // Aviso de "chamada em andamento" - relevante só para grupos, e
          // pra QUALQUER membro, esteja ele na chamada ou não.
          if (conv.isGroup) {
            setGroupCallBanners((prev) => {
              const next = { ...prev };
              if (entries.length > 0) {
                next[id] = { count: entries.length, names: entries.map((e) => e.username), conversationName: conv.name };
              } else {
                delete next[id];
              }
              return next;
            });
          }

          // Manutenção das conexões mesh - só relevante se EU estiver
          // ativamente nessa sala agora.
          if (groupCallStateRef.current === "active" && groupConversationIdRef.current === id) {
            const myId = user.id;
            const presentIds = new Set(entries.map((e) => e.userId).filter((pid) => pid !== myId));

            presentIds.forEach((peerId) => {
              if (groupPcsRef.current.has(peerId)) return;
              const meta = entries.find((e) => e.userId === peerId);
              // Regra de desempate simples pra ninguém mandar oferta pro
              // outro ao mesmo tempo: quem tem o id "menor" (comparação de
              // texto) inicia a conexão; o outro só espera a oferta chegar.
              if (myId < peerId) {
                initiateGroupOffer(id, peerId, meta);
              } else {
                setGroupCallPeers((prev) =>
                  upsertGroupPeer(prev, {
                    id: peerId,
                    username: meta?.username,
                    avatarColor: meta?.avatarColor,
                    avatarUrl: meta?.avatarUrl,
                    connected: false,
                  })
                );
              }
            });

            for (const existingId of Array.from(groupPcsRef.current.keys())) {
              if (!presentIds.has(existingId)) removeGroupPeer(existingId);
            }
          }
        })
        .subscribe();

      current.set(id, channel);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, user]);

  // Só desmonta de verdade quando a página do chat sai de cena (ex:
  // logout) - aí sim encerra e limpa tudo.
  useEffect(() => {
    return () => {
      const supabase = getSupabaseBrowserClient();
      for (const channel of channelsRef.current.values()) {
        supabase.removeChannel(channel);
      }
      channelsRef.current.clear();
      cleanupPeer();
      cleanupGroupCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    callState,
    peerName,
    conversationId,
    isMuted,
    duration,
    statusMessage,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    switchMicrophone,
    switchSpeaker,
    localVideoOn,
    localScreenSharing,
    localVideoStream,
    remoteVideoOn,
    remoteScreenSharing,
    remoteVideoStream,
    toggleVideo,
    toggleScreenShare,

    groupCallState,
    groupCallConversation,
    groupCallPeers,
    groupIsMuted,
    groupDuration,
    groupCallBanners,
    joinGroupCall,
    leaveGroupCall,
    toggleGroupMute,
    switchGroupMicrophone,
    switchGroupSpeaker,
    groupLocalVideoOn,
    groupLocalScreenSharing,
    groupLocalVideoStream,
    toggleGroupVideo,
    toggleGroupScreenShare,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall precisa ser usado dentro de um CallProvider");
  return ctx;
}
