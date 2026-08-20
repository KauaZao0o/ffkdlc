"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { buildAudioConstraints, buildVideoConstraints, getPreferredSpeaker } from "@/lib/callDevices";
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

function getScreenShareUnavailableMessage() {
  if (!window.isSecureContext) {
    return "O compartilhamento de tela no celular exige que o ffpkdlc seja aberto em HTTPS. Acesse pelo endereço https:// do site; um IP em http:// não libera essa permissão.";
  }

  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isAppleMobile) {
    return "O navegador do iPhone/iPad não disponibiliza compartilhamento de tela para sites. Você pode assistir às telas normalmente; para iniciar uma, use o ffpkdlc no computador ou um app nativo.";
  }

  return "Este navegador não disponibiliza captura de tela. Abra o ffpkdlc diretamente no Chrome ou Edge atualizado, em uma página HTTPS (não dentro de outro app).";
}

function supportsScreenShare() {
  return typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getDisplayMedia;
}

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
  // O vídeo (tela compartilhada OU câmera) usa uma única faixa de vídeo por
  // vez na mesma conexão - ligar a câmera desliga o compartilhamento de
  // tela (e vice-versa). "kind" indica qual das duas coisas está passando
  // no vídeo, pra rotular certo na tela ("compartilhando" vs "câmera").
  const [localVideoKind, setLocalVideoKind] = useState(null); // null | "screen" | "camera"
  const [remoteVideoKind, setRemoteVideoKind] = useState(null);
  const [localVideoStream, setLocalVideoStream] = useState(null);
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
  const videoStreamRef = useRef(null);
  const videoKindRef = useRef(null);

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
  useEffect(() => {
    videoKindRef.current = localVideoKind;
  }, [localVideoKind]);

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
  const [groupLocalVideoKind, setGroupLocalVideoKind] = useState(null); // null | "screen" | "camera"
  const [groupLocalVideoStream, setGroupLocalVideoStream] = useState(null);
  const [groupRemoteVideos, setGroupRemoteVideos] = useState({}); // peerId -> MediaStream
  const [groupRemoteVideoKinds, setGroupRemoteVideoKinds] = useState({}); // peerId -> "screen" | "camera"
  // {[conversationId]: {count, names, conversationName}} - permite mostrar um
  // aviso de "chamada em andamento" em QUALQUER grupo, mesmo um que a pessoa
  // não entrou (e nem estava olhando quando a chamada começou).
  const [groupCallBanners, setGroupCallBanners] = useState({});

  const groupPcsRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const groupAudioElsRef = useRef(new Map()); // peerId -> elemento <audio>
  const groupPendingCandidatesRef = useRef(new Map()); // peerId -> candidatos ICE recebidos cedo demais
  const groupDisconnectTimersRef = useRef(new Map()); // peerId -> timeout de tolerância antes de remover
  const groupLocalStreamRef = useRef(null);
  const groupConversationIdRef = useRef(null);
  const groupDurationIntervalRef = useRef(null);
  const groupCallStateRef = useRef("idle");
  const groupIsMutedRef = useRef(false);
  const groupVideoStreamRef = useRef(null);
  const groupVideoKindRef = useRef(null);

  useEffect(() => {
    groupVideoKindRef.current = groupLocalVideoKind;
  }, [groupLocalVideoKind]);

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
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    videoKindRef.current = null;
    setLocalVideoKind(null);
    setLocalVideoStream(null);
    setRemoteVideoKind(null);
    setRemoteVideoStream(null);
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
      return [...list, { id: patch.id, username: "…", avatarColor: "blue", avatarUrl: null, connected: false, ...patch }];
    }
    const next = [...list];
    next[idx] = { ...next[idx], ...patch };
    return next;
  }

  function createGroupPeerConnection(convId, peerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send(convId, "group-call-signal", { to: peerId, kind: "ice", candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "video") {
        const stream = e.streams[0] || new MediaStream([e.track]);
        setGroupRemoteVideos((prev) => ({ ...prev, [peerId]: stream }));
        e.track.onended = () => {
          setGroupRemoteVideos((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
          setGroupRemoteVideoKinds((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        };
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

    const audioEl = groupAudioElsRef.current.get(peerId);
    if (audioEl) audioEl.srcObject = null;
    groupAudioElsRef.current.delete(peerId);

    groupPendingCandidatesRef.current.delete(peerId);
    clearTimeout(groupDisconnectTimersRef.current.get(peerId));
    groupDisconnectTimersRef.current.delete(peerId);

    setGroupCallPeers((prev) => prev.filter((p) => p.id !== peerId));
    setGroupRemoteVideos((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    setGroupRemoteVideoKinds((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
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
    groupVideoStreamRef.current?.getVideoTracks().forEach((t) => pc.addTrack(t, groupVideoStreamRef.current));
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
      videoKind: groupVideoKindRef.current,
    });
  }

  function cleanupGroupCall() {
    clearInterval(groupDurationIntervalRef.current);
    for (const timer of groupDisconnectTimersRef.current.values()) clearTimeout(timer);
    groupDisconnectTimersRef.current.clear();

    for (const pc of groupPcsRef.current.values()) pc.close();
    groupPcsRef.current.clear();

    for (const audioEl of groupAudioElsRef.current.values()) audioEl.srcObject = null;
    groupAudioElsRef.current.clear();

    groupPendingCandidatesRef.current.clear();
    groupLocalStreamRef.current?.getTracks().forEach((t) => t.stop());
    groupLocalStreamRef.current = null;
    groupVideoStreamRef.current?.getTracks().forEach((t) => t.stop());
    groupVideoStreamRef.current = null;
    groupVideoKindRef.current = null;

    groupCallStateRef.current = "idle";
    groupIsMutedRef.current = false;
    groupConversationIdRef.current = null;

    setGroupCallState("idle");
    setGroupCallConversation(null);
    setGroupCallPeers([]);
    setGroupIsMuted(false);
    setGroupDuration(0);
    setGroupLocalVideoKind(null);
    setGroupLocalVideoStream(null);
    setGroupRemoteVideos({});
    setGroupRemoteVideoKinds({});
  }

  function createPeerConnection(convId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send(convId, "call-ice", { to: peerIdRef.current, callId: callIdRef.current, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "video") {
        const stream = e.streams[0] || new MediaStream([e.track]);
        setRemoteVideoStream(stream);
        e.track.onended = () => {
          setRemoteVideoStream(null);
          setRemoteVideoKind(null);
        };
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

  // O vídeo (tela compartilhada OU câmera) é uma faixa adicional na mesma
  // conexão WebRTC. Sempre renegociamos após adicioná-la/removê-la, para
  // que a outra pessoa receba a alteração sem precisar sair da ligação.
  const renegotiatePrivateCall = useCallback(async (videoKind) => {
    const pc = pcRef.current;
    if (!pc || !conversationIdRef.current) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send(conversationIdRef.current, "call-screen-offer", { to: peerIdRef.current, callId: callIdRef.current, sdp: offer, videoKind });
  }, []);

  const stopVideoShare = useCallback(async () => {
    const stream = videoStreamRef.current;
    if (!stream) return;
    videoStreamRef.current = null;
    videoKindRef.current = null;
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      try {
        await sender.replaceTrack(null);
      } catch {
        // removeTrack abaixo ainda força a renegociação quando replaceTrack
        // não for implementado pelo navegador.
      }
      pcRef.current?.removeTrack(sender);
    }
    stream.getTracks().forEach((track) => track.stop());
    setLocalVideoKind(null);
    setLocalVideoStream(null);
    send(conversationIdRef.current, "call-screen-stop", { to: peerIdRef.current, callId: callIdRef.current });
    try {
      await renegotiatePrivateCall(null);
    } catch (err) {
      console.error("Não foi possível atualizar o vídeo:", err);
    }
  }, [renegotiatePrivateCall]);

  // Inicia o envio de vídeo (tela ou câmera) - só uma faixa de vídeo por
  // vez. Se já tiver uma faixa de vídeo ativa (ex: trocando de câmera pra
  // tela), só troca o CONTEÚDO dela (replaceTrack) em vez de tirar e
  // renegociar de novo - renegociar duas vezes em sequência (parar +
  // começar) cria uma corrida entre as respostas SDP e derruba a chamada
  // com "Called in wrong state". Só uma nova faixa (do zero) precisa de
  // renegociação de verdade.
  const startVideoShare = useCallback(async (videoKind) => {
    if (videoKindRef.current === videoKind) return;
    if (videoKind === "screen" && !supportsScreenShare()) {
      alert(getScreenShareUnavailableMessage());
      return;
    }
    try {
      const stream =
        videoKind === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
          : await navigator.mediaDevices.getUserMedia({ video: buildVideoConstraints() });
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const previousStream = videoStreamRef.current;
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      track.onended = () => stopVideoShare();
      videoStreamRef.current = stream;
      videoKindRef.current = videoKind;
      setLocalVideoStream(stream);
      setLocalVideoKind(videoKind);

      if (sender) {
        await sender.replaceTrack(track);
        send(conversationIdRef.current, "call-video-kind", { to: peerIdRef.current, callId: callIdRef.current, videoKind });
      } else {
        pcRef.current?.addTrack(track, stream);
        await renegotiatePrivateCall(videoKind);
      }

      previousStream?.getTracks().forEach((t) => t.stop());
    } catch (err) {
      if (err?.name !== "NotAllowedError") console.error("Não foi possível iniciar o vídeo:", err);
    }
  }, [renegotiatePrivateCall, stopVideoShare]);

  const toggleScreenShare = useCallback(() => {
    if (videoKindRef.current === "screen") return stopVideoShare();
    return startVideoShare("screen");
  }, [startVideoShare, stopVideoShare]);

  const toggleCamera = useCallback(() => {
    if (videoKindRef.current === "camera") return stopVideoShare();
    return startVideoShare("camera");
  }, [startVideoShare, stopVideoShare]);

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

  const renegotiateGroupScreen = useCallback(async (videoKind) => {
    const convId = groupConversationIdRef.current;
    if (!convId) return;
    for (const [peerId, pc] of groupPcsRef.current) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send(convId, "group-call-signal", { to: peerId, kind: "screen-offer", sdp: offer, videoKind });
    }
  }, []);

  const stopGroupVideoShare = useCallback(async () => {
    const stream = groupVideoStreamRef.current;
    if (!stream) return;
    groupVideoStreamRef.current = null;
    groupVideoKindRef.current = null;
    for (const [peerId, pc] of groupPcsRef.current) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try {
          await sender.replaceTrack(null);
        } catch {
          // segue com a remoção e renegociação abaixo
        }
        pc.removeTrack(sender);
      }
      send(groupConversationIdRef.current, "group-call-signal", { to: peerId, kind: "screen-stop" });
    }
    stream.getTracks().forEach((track) => track.stop());
    setGroupLocalVideoKind(null);
    setGroupLocalVideoStream(null);
    try {
      await renegotiateGroupScreen(null);
    } catch (err) {
      console.error("Não foi possível atualizar o vídeo:", err);
    }
  }, [renegotiateGroupScreen]);

  // Inicia o envio de vídeo (tela ou câmera) pra TODOS os participantes da
  // chamada em grupo de uma vez - mesma regra da 1-a-1: só um vídeo por vez,
  // e trocar de tipo com uma faixa já ativa usa replaceTrack (sem
  // renegociar de novo) pra não disparar duas renegociações em corrida.
  const startGroupVideoShare = useCallback(async (videoKind) => {
    if (groupVideoKindRef.current === videoKind) return;
    if (videoKind === "screen" && !supportsScreenShare()) {
      alert(getScreenShareUnavailableMessage());
      return;
    }
    try {
      const stream =
        videoKind === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
          : await navigator.mediaDevices.getUserMedia({ video: buildVideoConstraints() });
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const previousStream = groupVideoStreamRef.current;
      const hadVideo = !!previousStream;
      track.onended = () => stopGroupVideoShare();
      groupVideoStreamRef.current = stream;
      groupVideoKindRef.current = videoKind;
      setGroupLocalVideoStream(stream);
      setGroupLocalVideoKind(videoKind);

      if (hadVideo) {
        for (const pc of groupPcsRef.current.values()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(track);
        }
        const convId = groupConversationIdRef.current;
        for (const peerId of groupPcsRef.current.keys()) {
          send(convId, "group-call-signal", { to: peerId, kind: "video-kind", videoKind });
        }
      } else {
        for (const pc of groupPcsRef.current.values()) pc.addTrack(track, stream);
        await renegotiateGroupScreen(videoKind);
      }

      previousStream?.getTracks().forEach((t) => t.stop());
    } catch (err) {
      if (err?.name !== "NotAllowedError") console.error("Não foi possível iniciar o vídeo:", err);
    }
  }, [renegotiateGroupScreen, stopGroupVideoShare]);

  const toggleGroupScreenShare = useCallback(() => {
    if (groupVideoKindRef.current === "screen") return stopGroupVideoShare();
    return startGroupVideoShare("screen");
  }, [startGroupVideoShare, stopGroupVideoShare]);

  const toggleGroupCamera = useCallback(() => {
    if (groupVideoKindRef.current === "camera") return stopGroupVideoShare();
    return startGroupVideoShare("camera");
  }, [startGroupVideoShare, stopGroupVideoShare]);

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
          if (!pc || pc.signalingState !== "have-local-offer") return;
          await pc.setRemoteDescription(payload.sdp);
          remoteDescSetRef.current = true;
          await flushPendingCandidates();
          stopRingtone();
          setCallState("connected");
          setDuration(0);
          durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        })
        .on("broadcast", { event: "call-screen-offer" }, async ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current || !pcRef.current) return;
          const pc = pcRef.current;
          if (pc.signalingState !== "stable") return;
          await pc.setRemoteDescription(payload.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          setRemoteVideoKind(payload.videoKind || null);
          send(id, "call-screen-answer", { to: payload.from, callId: payload.callId, sdp: answer });
        })
        .on("broadcast", { event: "call-screen-answer" }, async ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current || !pcRef.current) return;
          // Uma resposta pode chegar depois que a conexão já voltou a ficar
          // "stable" (ex: outra renegociação terminou primeiro) - nesse caso
          // essa resposta está desatualizada; aplicá-la quebra a conexão.
          if (pcRef.current.signalingState !== "have-local-offer") return;
          await pcRef.current.setRemoteDescription(payload.sdp);
        })
        .on("broadcast", { event: "call-video-kind" }, ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current) return;
          setRemoteVideoKind(payload.videoKind || null);
        })
        .on("broadcast", { event: "call-screen-stop" }, ({ payload }) => {
          if (payload.from === user.id || payload.callId !== callIdRef.current) return;
          setRemoteVideoStream(null);
          setRemoteVideoKind(null);
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
        // ---------- Chamada em grupo ----------
        .on("broadcast", { event: "group-call-ring" }, ({ payload }) => {
          if (payload.from === user.id) return;
          // Só um "ding" simples de aviso - o aviso persistente de "chamada
          // em andamento" vem da presença, não deste evento.
          if (soundEnabledRef.current) playChime();
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
              groupVideoStreamRef.current?.getVideoTracks().forEach((t) => pc.addTrack(t, groupVideoStreamRef.current));
              await boostAudioBitrate(pc);
            }
            if (pc.signalingState !== "stable") return;
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
            if (payload.videoKind) {
              setGroupRemoteVideoKinds((prev) => ({ ...prev, [payload.from]: payload.videoKind }));
            }
            send(id, "group-call-signal", { to: payload.from, kind: "answer", sdp: answer, videoKind: groupVideoKindRef.current });
          } else if (payload.kind === "answer") {
            const pc = groupPcsRef.current.get(payload.from);
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(payload.sdp);
              await flushGroupPendingCandidates(payload.from);
            }
            if (payload.videoKind) {
              setGroupRemoteVideoKinds((prev) => ({ ...prev, [payload.from]: payload.videoKind }));
            }
          } else if (payload.kind === "screen-offer") {
            const pc = groupPcsRef.current.get(payload.from);
            if (!pc || pc.signalingState !== "stable") return;
            await pc.setRemoteDescription(payload.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            setGroupRemoteVideoKinds((prev) => {
              const next = { ...prev };
              if (payload.videoKind) next[payload.from] = payload.videoKind;
              else delete next[payload.from];
              return next;
            });
            send(id, "group-call-signal", { to: payload.from, kind: "screen-answer", sdp: answer });
          } else if (payload.kind === "screen-answer") {
            const pc = groupPcsRef.current.get(payload.from);
            // Resposta desatualizada (outra renegociação já concluiu antes
            // dela chegar) - aplicá-la quebraria a conexão.
            if (pc && pc.signalingState === "have-local-offer") await pc.setRemoteDescription(payload.sdp);
          } else if (payload.kind === "video-kind") {
            setGroupRemoteVideoKinds((prev) => ({ ...prev, [payload.from]: payload.videoKind || null }));
          } else if (payload.kind === "screen-stop") {
            setGroupRemoteVideos((prev) => {
              const next = { ...prev };
              delete next[payload.from];
              return next;
            });
            setGroupRemoteVideoKinds((prev) => {
              const next = { ...prev };
              delete next[payload.from];
              return next;
            });
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
    localVideoKind,
    remoteVideoKind,
    localVideoStream,
    remoteVideoStream,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleScreenShare,
    toggleCamera,
    switchMicrophone,
    switchSpeaker,

    groupCallState,
    groupCallConversation,
    groupCallPeers,
    groupIsMuted,
    groupDuration,
    groupLocalVideoKind,
    groupLocalVideoStream,
    groupRemoteVideos,
    groupRemoteVideoKinds,
    groupCallBanners,
    joinGroupCall,
    leaveGroupCall,
    toggleGroupMute,
    toggleGroupScreenShare,
    toggleGroupCamera,
    switchGroupMicrophone,
    switchGroupSpeaker,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall precisa ser usado dentro de um CallProvider");
  return ctx;
}
