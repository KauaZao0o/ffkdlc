"use client";

import { useEffect, useRef, useState } from "react";
import { uploadChatFile } from "@/lib/uploadImage";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB - imagens, áudio
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20MB - documentos (pdf, csv, txt...)
const MAX_TEXTAREA_HEIGHT = 140;

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// mp4/aac toca em qualquer navegador (Chrome, Firefox, Safari, iOS,
// Android) - tenta gravar nesse formato primeiro. O Safari nunca sabe
// gravar em webm, então nesses navegadores isso já cai direto pro mp4;
// nos outros, só usa webm se mp4 não estiver disponível pra gravação.
const AUDIO_MIME_CANDIDATES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function pickAudioMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

// A extensão do arquivo precisa bater com o mimeType real gravado - o
// Safari recusa tocar um áudio cuja extensão da URL não condiz com o
// conteúdo real, mesmo com o Content-Type certo no servidor.
function extensionForMimeType(mimeType) {
  if (mimeType?.includes("mp4")) return "m4a";
  if (mimeType?.includes("ogg")) return "ogg";
  return "webm";
}

// Encontra o "@algumacoisa" que está sendo digitado bem antes do cursor,
// se houver - usado pra abrir a lista de menção.
function findActiveMention(value, cursorPos) {
  const uptoCursor = value.slice(0, cursorPos);
  const at = uptoCursor.lastIndexOf("@");
  if (at === -1) return null;

  // Se tiver espaço ou quebra de linha entre o "@" e o cursor, não é uma
  // menção em andamento (é um "@" que já ficou pra trás no texto).
  const between = uptoCursor.slice(at + 1);
  if (/\s/.test(between)) return null;

  // "@" precisa estar no início do texto ou depois de espaço/quebra de linha,
  // pra não disparar no meio de um e-mail por exemplo.
  const before = uptoCursor[at - 1];
  if (before && !/\s/.test(before)) return null;

  return { start: at, query: between };
}

export default function MessageInput({ channelRef, userId, conversationId, participants = [], onSend, replyTo, onCancelReply }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mention, setMention] = useState(null); // { start, query }
  const [mentionIndex, setMentionIndex] = useState(0);

  const typingTimeout = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingSecondsRef = useRef(0);
  const cancelledRef = useRef(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Se o usuário sair da conversa/fechar a página no meio de uma gravação,
  // garante que o microfone é liberado.
  useEffect(() => {
    return () => {
      clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const mentionMatches = mention
    ? participants.filter((p) => p.username.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    setMentionIndex(0);
  }, [mention?.query]);

  // Ao escolher "Responder" numa mensagem, leva o foco direto pro campo de
  // texto - igual ao WhatsApp, sem precisar clicar de novo no campo.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  function replyPreviewText(target) {
    if (!target) return "";
    if (target.type === "image") return "📷 Foto";
    if (target.type === "audio") return "🎤 Áudio";
    if (target.type === "file") return "📎 Arquivo";
    return target.content || "";
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + "px";
  }

  function sendTyping(isTyping) {
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, isTyping },
    });
  }

  function handleChange(e) {
    const value = e.target.value;
    setText(value);
    requestAnimationFrame(autoResize);

    sendTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 1200);

    setMention(findActiveMention(value, e.target.selectionStart));
  }

  function selectMention(username) {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.start + 1 + mention.query.length);
    const newText = `${before}@${username} ${after}`;
    setText(newText);
    setMention(null);

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const cursor = before.length + username.length + 2;
      el.focus();
      el.setSelectionRange(cursor, cursor);
      autoResize();
    });
  }

  function handleKeyDown(e) {
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionMatches[mentionIndex].username);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }

    if (e.key === "Enter") {
      // Shift+Enter quebra linha, Enter sozinho envia - sem depender de
      // detecção de "é celular ou não" (notebooks com tela touch reportavam
      // suporte a toque e quebravam esse comportamento mesmo com teclado
      // físico conectado).
      if (e.shiftKey) return;
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend({ content: text });
    setText("");
    setMention(null);
    sendTyping(false);
    requestAnimationFrame(autoResize);
  }

  async function sendFile(file, maxSize = MAX_FILE_SIZE, knownDurationSeconds) {
    if (file.size > maxSize) {
      alert(`O arquivo precisa ter no máximo ${Math.round(maxSize / (1024 * 1024))}MB.`);
      return;
    }

    const type = file.type.startsWith("audio/")
      ? "audio"
      : file.type.startsWith("image/")
      ? "image"
      : "file";

    setUploading(true);
    try {
      let fileUrl = await uploadChatFile(file, conversationId);

      // Embute a duração real (contada durante a gravação) na URL do
      // áudio - assim quem for ouvir não depende só do navegador dele pra
      // calcular a duração de um áudio gravado pelo MediaRecorder, o que
      // em celular às vezes trava em "0:00".
      if (type === "audio" && knownDurationSeconds) {
        fileUrl += (fileUrl.includes("?") ? "&" : "?") + `d=${Math.round(knownDurationSeconds)}`;
      }

      onSend({ content: "", type, fileUrl });
    } catch (err) {
      console.error(err);
      alert("Não foi possível enviar. Confira se o bucket 'chat-files' existe no Supabase.");
    } finally {
      setUploading(false);
    }
  }

  // Permite colar uma imagem copiada (print, ou copiada de outro site)
  // direto no campo de mensagem com Ctrl+V / Cmd+V.
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          sendFile(file);
        }
        break;
      }
    }
  }

  function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    const isDoc = !file.type.startsWith("image/") && !file.type.startsWith("audio/");
    sendFile(file, isDoc ? MAX_DOC_SIZE : MAX_FILE_SIZE);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (cancelledRef.current) {
          cancelledRef.current = false;
          audioChunksRef.current = [];
          return;
        }

        // Gravações de menos de 1 segundo (ex: toque sem querer no botão do
        // microfone) costumam virar um arquivo de áudio quebrado, que o
        // navegador de quem recebe não consegue tocar depois. Em vez de
        // mandar isso pro chat, descarta em silêncio.
        if (recordingSecondsRef.current < 1) {
          audioChunksRef.current = [];
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const ext = extensionForMimeType(blob.type);
          const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type });
          await sendFile(file, MAX_FILE_SIZE, recordingSecondsRef.current);
        }
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
        recordingSecondsRef.current += 1;
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("Não foi possível acessar o microfone. Confira as permissões do navegador para esse site.");
    }
  }

  function togglePause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (isPaused) {
      recorder.resume();
      setIsPaused(false);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
        recordingSecondsRef.current += 1;
      }, 1000);
    } else {
      recorder.pause();
      setIsPaused(true);
      clearInterval(recordingIntervalRef.current);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setIsPaused(false);
  }

  function cancelRecording() {
    cancelledRef.current = true;
    mediaRecorderRef.current?.stop();
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setIsPaused(false);
  }

  return (
    <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
      {replyTo && !isRecording && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderLeft: "3px solid var(--group-avatar-fg)",
            margin: "8px 12px 0",
            background: "var(--surface-hover)",
            borderRadius: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--group-avatar-fg)" }}>
              Respondendo a {replyTo.sender?.username}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {replyPreviewText(replyTo)}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            title="Cancelar resposta"
            className="composer-icon-btn"
            style={{ width: 28, height: 28, fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          position: "relative",
          padding: "10px 12px",
          display: "flex",
          gap: 6,
          alignItems: "flex-end",
        }}
      >
      {mention && mentionMatches.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 12,
            marginBottom: 4,
            width: 220,
            maxHeight: 220,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 30,
          }}
        >
          {mentionMatches.map((p, i) => (
            <button
              type="button"
              key={p.id}
              onClick={() => selectMention(p.username)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                borderRadius: 0,
                padding: "8px 12px",
                fontSize: 13,
                background: i === mentionIndex ? "var(--surface-hover)" : "var(--surface)",
                color: "var(--text)",
              }}
            >
              @{p.username}
            </button>
          ))}
        </div>
      )}

      {isRecording ? (
        // Barra de gravação: sem campo de texto e sem botão "Enviar" aqui -
        // eles não fazem sentido durante a gravação e eram a causa do
        // botão "Enviar" ser empurrado pra fora da tela no mobile.
        <>
          <button
            type="button"
            onClick={cancelRecording}
            title="Cancelar gravação"
            className="composer-icon-btn danger"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={togglePause}
            title={isPaused ? "Retomar gravação" : "Pausar gravação"}
            className="composer-icon-btn"
          >
            {isPaused ? "▶" : "⏸"}
          </button>
          <div className="composer-recording-pill">
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "var(--danger)",
                flexShrink: 0,
                opacity: isPaused ? 0.4 : 1,
                animation: isPaused ? "none" : "recording-pulse 1s infinite",
              }}
            />
            <span style={{ whiteSpace: "nowrap" }}>
              {isPaused ? "Pausado" : "Gravando"} · {formatDuration(recordingSeconds)}
            </span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            title="Parar e enviar áudio"
            className="composer-send-btn danger"
          >
            ⏹
          </button>
          <style jsx>{`
            @keyframes recording-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.35; }
            }
          `}</style>
        </>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFilePicked}
            accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,image/*"
            style={{ display: "none" }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFilePicked}
            style={{ display: "none" }}
          />
          <button
            type="button"
            title="Anexar arquivo"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="composer-icon-btn"
          >
            📎
          </button>
          <button
            type="button"
            title="Tirar foto"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="composer-icon-btn"
          >
            📷
          </button>
          <button
            type="button"
            title="Gravar áudio"
            onClick={startRecording}
            disabled={uploading}
            className="composer-icon-btn"
          >
            🎤
          </button>
          <div className="composer-textarea-wrap">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={uploading ? "Enviando..." : "Digite uma mensagem"}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={uploading}
              className="composer-textarea"
              style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
            />
          </div>
          <button type="submit" title="Enviar mensagem" disabled={uploading} className="composer-send-btn">
            ➤
          </button>
        </>
      )}
    </form>
    </div>
  );
}
