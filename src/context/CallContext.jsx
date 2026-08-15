"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { buildAudioConstraints, getPreferredSpeaker } from "@/lib/callDevices";
import { startRingtone } from "@/lib/sound";
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

  function createPeerConnection(convId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send(convId, "call-ice", { to: peerIdRef.current, callId: callIdRef.current, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
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
    if (callStateRef.current !== "idle") return;

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

  // Assina o canal de sinalização de TODA conversa privada da pessoa ao
  // mesmo tempo (não só da que está aberta na tela) - é isso que faz uma
  // ligação chegar mesmo estando em outra conversa. Reage à lista de
  // conversas mudando (entrar numa conversa nova, por exemplo), mas só
  // cria/remove canal para o que realmente mudou - a lista chega de novo a
  // cada poll (a cada alguns segundos) mesmo sem nada ter mudado de fato.
  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    const wantedIds = new Set((conversations || []).filter((c) => !c.isGroup).map((c) => c.id));
    const current = channelsRef.current;

    for (const [id, channel] of current) {
      if (!wantedIds.has(id)) {
        supabase.removeChannel(channel);
        current.delete(id);
      }
    }

    wantedIds.forEach((id) => {
      if (current.has(id)) return;

      const channel = supabase
        .channel(`call-${id}`)
        .on("broadcast", { event: "call-offer" }, ({ payload }) => {
          if (payload.from === user.id) return;

          // Se já estiver em outra chamada, recusa automaticamente (ocupado).
          if (callStateRef.current !== "idle") {
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
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall precisa ser usado dentro de um CallProvider");
  return ctx;
}
