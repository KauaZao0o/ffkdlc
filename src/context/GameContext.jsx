"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { checkWinner } from "@/lib/ticTacToe";

const GameContext = createContext(null);

const CHALLENGE_TIMEOUT_MS = 30000;

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Todo o multiplayer de jogos (por enquanto só jogo da velha) fica isolado
// aqui, montado uma vez na página do chat - igual ao CallContext. Cada
// pessoa escuta sua própria "caixa de entrada" (game-inbox-<userId>) pra
// poder receber um desafio de qualquer lugar do site, mesmo sem ter o
// painel de jogos aberto. Depois que os dois aceitam, entram numa sala
// (game-room-<gameId>) só deles pra trocar as jogadas em tempo real - tudo
// via broadcast do Supabase, sem precisar guardar nada no banco.
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

  function startGameRoom(gameId, opponentId, opponentUsername, opponentAvatarColor, opponentAvatarUrl, mySymbol) {
    cleanupRoom();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`game-room-${gameId}`)
      .on("broadcast", { event: "move" }, ({ payload }) => {
        if (payload.by === userRef.current?.id) return;
        applyMove(payload.index, payload.symbol);
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        if (payload.by === userRef.current?.id) return;
        setActiveGame((prev) => (prev ? { ...prev, status: "opponent-left" } : prev));
      })
      .on("broadcast", { event: "rematch" }, ({ payload }) => {
        if (payload.by === userRef.current?.id) return;
        setActiveGame((prev) =>
          prev ? { ...prev, board: Array(9).fill(null), turn: "X", status: "playing", resultMessage: "", winLine: null } : prev
        );
      })
      .subscribe();
    roomChannelRef.current = channel;

    setActiveGame({
      gameId,
      opponentId,
      opponentUsername,
      opponentAvatarColor,
      opponentAvatarUrl,
      mySymbol,
      board: Array(9).fill(null),
      turn: "X",
      status: "playing",
      resultMessage: "",
      winLine: null,
    });
  }

  function applyMove(index, symbol) {
    setActiveGame((prev) => {
      if (!prev || prev.board[index] || prev.status !== "playing") return prev;
      const board = [...prev.board];
      board[index] = symbol;
      const result = checkWinner(board);
      let status = "playing";
      let resultMessage = "";
      if (result) {
        status = "ended";
        resultMessage =
          result.winner === "draw" ? "Empate!" : result.winner === prev.mySymbol ? "Você venceu! 🎉" : "Você perdeu.";
      }
      return { ...prev, board, turn: symbol === "X" ? "O" : "X", status, resultMessage, winLine: result?.line || null };
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
        startGameRoom(pending.gameId, pending.to, pending.toUsername, pending.toAvatarColor, pending.toAvatarUrl, "X");
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

  function sendChallenge(target) {
    if (!user || !target || target.id === user.id || outgoingChallengeRef.current) return;
    const gameId = randomId();
    sendToInbox(target.id, "challenge", {
      gameId,
      from: user.id,
      fromUsername: user.username,
      fromAvatarColor: user.avatarColor,
      fromAvatarUrl: user.avatarUrl,
    });
    setOutgoingChallenge({
      gameId,
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
    startGameRoom(challenge.gameId, challenge.from, challenge.fromUsername, challenge.fromAvatarColor, challenge.fromAvatarUrl, "O");
  }

  function declineChallenge() {
    const challenge = incomingChallenge;
    if (!challenge) return;
    sendToInbox(challenge.from, "challenge-declined", { gameId: challenge.gameId });
    setIncomingChallenge(null);
  }

  function makeMove(index) {
    const game = activeGameRef.current;
    if (!game || game.board[index] || game.status !== "playing" || game.turn !== game.mySymbol) return;
    applyMove(index, game.mySymbol);
    roomChannelRef.current?.send({
      type: "broadcast",
      event: "move",
      payload: { index, symbol: game.mySymbol, by: userRef.current?.id },
    });
  }

  function rematch() {
    roomChannelRef.current?.send({ type: "broadcast", event: "rematch", payload: { by: userRef.current?.id } });
    setActiveGame((prev) =>
      prev ? { ...prev, board: Array(9).fill(null), turn: "X", status: "playing", resultMessage: "", winLine: null } : prev
    );
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
