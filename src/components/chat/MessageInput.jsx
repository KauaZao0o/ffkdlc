"use client";

import { useEffect, useRef, useState } from "react";
import { uploadChatFile } from "@/lib/uploadImage";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MessageInput({ channelRef, userId, conversationId, onSend }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const typingTimeout = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Se o usuário sair da conversa/fechar a página no meio de uma gravação,
  // garante que o microfone é liberado.
  useEffect(() => {
    return () => {
      clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  function sendTyping(isTyping) {
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, isTyping },
    });
  }

  function handleChange(e) {
    setText(e.target.value);

    sendTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 1200);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend({ content: text });
    setText("");
    sendTyping(false);
  }

  async function sendFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      alert("O arquivo precisa ter no máximo 5MB.");
      return;
    }

    const type = file.type.startsWith("audio/") ? "audio" : "image";

    setUploading(true);
    try {
      const fileUrl = await uploadChatFile(file, conversationId);
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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
          await sendFile(file);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("Não foi possível acessar o microfone. Confira as permissões do navegador para esse site.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        background: "var(--surface)",
      }}
    >
      <button
        type="button"
        title={isRecording ? "Parar e enviar áudio" : "Gravar áudio"}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={uploading}
        style={
          isRecording
            ? { background: "var(--danger)", color: "white", borderColor: "var(--danger)", whiteSpace: "nowrap" }
            : undefined
        }
      >
        {isRecording ? `⏹ ${formatDuration(recordingSeconds)}` : "🎤"}
      </button>
      <input
        type="text"
        placeholder={
          isRecording
            ? "Gravando áudio..."
            : uploading
            ? "Enviando..."
            : "Digite uma mensagem (ou cole uma imagem aqui)"
        }
        value={text}
        onChange={handleChange}
        onPaste={handlePaste}
        disabled={uploading || isRecording}
        style={{ flex: 1 }}
      />
      <button type="submit" className="primary" disabled={uploading || isRecording}>
        Enviar
      </button>
    </form>
  );
}
