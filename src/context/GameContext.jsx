"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { GAMES } from "@/lib/games";

const GameContext = createContext(null);

const CHALLENGE_TIMEOUT_MS = 30000;

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Todo o multiplayer de jogos fica isolado aqui, montado uma vez na página
// do chat - igual ao CallContext. Cada pessoa escuta sua própria "caixa de
// entrada" (game-inbox-<userId>) pra poder receber um desafio de qualquer
// lugar do site, mesmo sem ter o painel de jogos aberto. Depois que os dois
// aceitam, entram numa sala (game-room-<gameId>) só deles pra trocar as
// jogadas em tempo real - tudo via broadcast do Supabase, sem precisar
// guardar nada no banco.
//
// Cada jogo (jogo da velha, dama, uno, truco) só define as regras em
// src/lib/games/*.js (estado inicial, validar+aplicar uma jogada, checar
// quem venceu) - toda a parte de desafio/sala/reconexão é genérica e igual
// pra qualquer jogo novo que for adicionado.
//
// Jogos como uno/truco embaralham cartas (aleatório) - pra não embaralhar
// diferente em cada tela, só quem desafiou (símbolo "X") sorteia o estado
// inicial e manda pronto pra outra pessoa (evento "state-init"); quem
// aceitou só espera chegar. Dali em diante, cada jogada já é determinística
// (mesma função aplicada aos dois lados), então só precisa transmitir a
// jogada em si, não o estado inteiro.
export function GameProvider({ user, children }) {
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [outgoingChallenge, setOutgoingChallenge] = useState(null);
  const [activeGame, setActiveGame] = useState(null);

  const userRef = useRef(user);
  const outgoingChallengeRef = useRef(null);
  const activeGameRef = useRef(null);
  const inboxChannelRef = useRef(null);
  const roomChannelRef = useRef(null);
  const challengeTimeoutRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    outgoingChallengeRef.current = outgoingChallenge;
  }, [outgoingChallenge]);
  useEffect(() => {
    activeGameRef.current = activeGame;
  }, [activeGame]);

  // Manda um evento pra caixa de entrada de outra pessoa - entra no canal
  // dela, manda, e sai logo em seguida (não precisa ficar conectado).
  function sendToInbox(targetUserId, event, payload) {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`game-inbox-${targetUserId}`);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({ type: "broadcast", event, payload });
        setTimeout(() => supabase.removeChannel(channel), 2000);
      }
    });
  }

  function cleanupRoom() {
    if (roomChannelRef.current) {
      const supabase = getSupabaseBrowserClient();
      supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
  }

  function buildResultMessage(outcome, mySymbol) {
    if (outcome.winner === "draw") return "Empate!";
    return outcome.winner === mySymbol ? "Você venceu! 🎉" : "Você perdeu.";
  }

  function startGameRoom(gameId, gameType, opponentId, opponentUsername, opponentAvatarColor, opponentAvatarUrl, mySymbol) {
    cleanupRoom();
    const supabase = getSupabaseBrowserClient();
    const gameModule = GAMES[gameType];

    const channel = supabase
      .channel(`game-room-${gameId}`)
      .on("broadcast", { event: "state-init" }, ({ payload }) => {
        if (payload.by === userRef.current?.id) return;
        setActiveGame((prev) => (prev ? { ...prev, ...payload.state, status: "playing" } : prev));
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        if (payload.by === userRef.current?.id) return;
        applyIncomingMove(payload.move, payload.symbol);
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        if (payload.by === userRef.current?.id) return;
        setActiveGame((prev) => (prev ? { ...prev, status: "opponent-left" } : prev));
      })
      .on("broadcast", { event: "rematch" }, ({ payload }) => {
        if (payload.by === userRef.current?.id) return;
        setActiveGame((prev) => (prev ? { ...prev, ...payload.state, status: "playing", resultMessage: "" } : prev));
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || mySymbol !== "X") return;
        // Quem desafiou sorteia o estado inicial (baralhos etc) e manda
        // pronto - evita os dois lados embaralharem diferente.
        const initial = { ...gameModule.createInitialState(), turn: "X", roundStarter: "X" };
        channel.send({ type: "broadcast", event: "state-init", payload: { by: userRef.current?.id, state: initial } });
        setActiveGame((prev) => (prev ? { ...prev, ...initial, status: "playing" } : prev));
      });

    roomChannelRef.current = channel;

    setActiveGame({
      gameId,
      gameType,
      opponentId,
      opponentUsername,
      opponentAvatarColor,
      opponentAvatarUrl,
      mySymbol,
      status: "connecting",
      resultMessage: "",
      matchScore: { X: 0, O: 0 },
    });
  }

  // Aplica uma jogada (minha, otimista, ou recebida do outro lado) usando a
  // mesma função pura do jogo - como o estado já está sincronizado e a
  // função não usa aleatoriedade, os dois lados chegam ao mesmo resultado.
  function applyIncomingMove(move, symbol) {
    setActiveGame((prev) => {
      if (!prev || prev.status !== "playing") return prev;
      const gameModule = GAMES[prev.gameType];
      const patch = gameModule.applyMove(prev, move, symbol);
      if (!patch) return prev;

      const merged = { ...prev, ...patch };
      const outcome = gameModule.checkResult(merged);
      if (!outcome) return merged;

      const matchScore = { ...prev.matchScore };
      if (outcome.winner !== "draw") matchScore[outcome.winner] = (matchScore[outcome.winner] || 0) + 1;

      return {
        ...merged,
        status: "ended",
        resultMessage: buildResultMessage(outcome, prev.mySymbol),
        matchScore,
        winLine: outcome.line || null,
      };
    });
  }

  // Caixa de entrada pessoal - escuta desafios chegando de qualquer lugar.
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`game-inbox-${user.id}`)
      .on("broadcast", { event: "challenge" }, ({ payload }) => {
        setIncomingChallenge(payload);
      })
      .on("broadcast", { event: "challenge-declined" }, ({ payload }) => {
        if (outgoingChallengeRef.current?.gameId === payload.gameId) {
          clearTimeout(challengeTimeoutRef.current);
          setOutgoingChallenge(null);
        }
      })
      .on("broadcast", { event: "challenge-cancelled" }, ({ payload }) => {
        setIncomingChallenge((prev) => (prev?.gameId === payload.gameId ? null : prev));
      })
      .on("broadcast", { event: "challenge-accepted" }, ({ payload }) => {
        const pending = outgoingChallengeRef.current;
        if (!pending || pending.gameId !== payload.gameId) return;
        clearTimeout(challengeTimeoutRef.current);
        setOutgoingChallenge(null);
        startGameRoom(pending.gameId, pending.gameType, pending.to, pending.toUsername, pending.toAvatarColor, pending.toAvatarUrl, "X");
      })
      .subscribe();

    inboxChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      inboxChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Encerra a sala se a página do chat for desmontada de vez (ex: logout).
  useEffect(() => {
    return () => {
      cleanupRoom();
      clearTimeout(challengeTimeoutRef.current);
    };
  }, []);

  function sendChallenge(target, gameType) {
    if (!user || !target || target.id === user.id || outgoingChallengeRef.current || !GAMES[gameType]) return;
    const gameId = randomId();
    sendToInbox(target.id, "challenge", {
      gameId,
      gameType,
      from: user.id,
      fromUsername: user.username,
      fromAvatarColor: user.avatarColor,
      fromAvatarUrl: user.avatarUrl,
    });
    setOutgoingChallenge({
      gameId,
      gameType,
      to: target.id,
      toUsername: target.username,
      toAvatarColor: target.avatarColor,
      toAvatarUrl: target.avatarUrl,
    });

    clearTimeout(challengeTimeoutRef.current);
    challengeTimeoutRef.current = setTimeout(() => {
      setOutgoingChallenge((prev) => (prev?.gameId === gameId ? null : prev));
    }, CHALLENGE_TIMEOUT_MS);
  }

  function cancelChallenge() {
    const pending = outgoingChallengeRef.current;
    if (!pending) return;
    clearTimeout(challengeTimeoutRef.current);
    sendToInbox(pending.to, "challenge-cancelled", { gameId: pending.gameId });
    setOutgoingChallenge(null);
  }

  function acceptChallenge() {
    const challenge = incomingChallenge;
    if (!challenge) return;
    sendToInbox(challenge.from, "challenge-accepted", { gameId: challenge.gameId });
    setIncomingChallenge(null);
    startGameRoom(
      challenge.gameId,
      challenge.gameType,
      challenge.from,
      challenge.fromUsername,
      challenge.fromAvatarColor,
      challenge.fromAvatarUrl,
      "O"
    );
  }

  function declineChallenge() {
    const challenge = incomingChallenge;
    if (!challenge) return;
    sendToInbox(challenge.from, "challenge-declined", { gameId: challenge.gameId });
    setIncomingChallenge(null);
  }

  function makeMove(move) {
    const game = activeGameRef.current;
    if (!game || game.status !== "playing" || game.turn !== game.mySymbol) return;
    applyIncomingMove(move, game.mySymbol);
    roomChannelRef.current?.send({
      type: "broadcast",
      event: "move",
      payload: { move, symbol: game.mySymbol, by: userRef.current?.id },
    });
  }

  // Quem clica em "jogar de novo" sorteia a próxima rodada e já alterna
  // quem começa jogando (antes sempre era "X" - se a pessoa fosse sempre
  // quem desafia, sempre começaria ela).
  function rematch() {
    const game = activeGameRef.current;
    if (!game) return;
    const gameModule = GAMES[game.gameType];
    const nextStarter = game.roundStarter === "X" ? "O" : "X";
    const initial = { ...gameModule.createInitialState(), turn: nextStarter, roundStarter: nextStarter };

    roomChannelRef.current?.send({ type: "broadcast", event: "rematch", payload: { by: userRef.current?.id, state: initial } });
    setActiveGame((prev) => (prev ? { ...prev, ...initial, status: "playing", resultMessage: "" } : prev));
  }

  function leaveGame() {
    roomChannelRef.current?.send({ type: "broadcast", event: "leave", payload: { by: userRef.current?.id } });
    cleanupRoom();
    setActiveGame(null);
  }

  const value = {
    incomingChallenge,
    outgoingChallenge,
    activeGame,
    sendChallenge,
    cancelChallenge,
    acceptChallenge,
    declineChallenge,
    makeMove,
    rematch,
    leaveGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame precisa ser usado dentro de um GameProvider");
  return ctx;
}
