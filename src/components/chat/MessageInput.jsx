"use client";

import { useEffect, useRef, useState } from "react";
import { uploadChatFile } from "@/lib/uploadImage";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB - imagens, áudio
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20MB - documentos (pdf, csv, txt...)

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MessageInput({ channelRef, userId, conversationId, onSend }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const typingTimeout = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const cancelledRef = useRef(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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

  async function sendFile(file, maxSize = MAX_FILE_SIZE) {
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
      const recorder = new MediaRecorder(stream);
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

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
          await sendFile(file);
        }
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
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
    <form
      onSubmit={handleSubmit}
      style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: 6,
        alignItems: "center",
        background: "var(--surface)",
      }}
    >
      {isRecording ? (
        // Barra de gravação: sem campo de texto e sem botão "Enviar" aqui -
        // eles não fazem sentido durante a gravação e eram a causa do
        // botão "Enviar" ser empurrado pra fora da tela no mobile.
        <>
          <button
            type="button"
            onClick={cancelRecording}
            title="Cancelar gravação"
            style={{ color: "var(--danger)", flexShrink: 0, padding: "8px 10px" }}
          >
            ✕
          </button>
          <button
            type="button"
            onClick={togglePause}
            title={isPaused ? "Retomar gravação" : "Pausar gravação"}
            style={{ flexShrink: 0, padding: "8px 10px" }}
          >
            {isPaused ? "▶" : "⏸"}
          </button>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 6px",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
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
            style={{
              background: "var(--danger)",
              color: "white",
              borderColor: "var(--danger)",
              flexShrink: 0,
              padding: "8px 10px",
            }}
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
            style={{ flexShrink: 0, padding: "8px 10px" }}
          >
            📎
          </button>
          <button
            type="button"
            title="Tirar foto"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            style={{ flexShrink: 0, padding: "8px 10px" }}
          >
            📷
          </button>
          <button
            type="button"
            title="Gravar áudio"
            onClick={startRecording}
            disabled={uploading}
            style={{ flexShrink: 0, padding: "8px 10px" }}
          >
            🎤
          </button>
          <input
            type="text"
            placeholder={uploading ? "Enviando..." : "Digite uma mensagem (ou cole uma imagem aqui)"}
            value={text}
            onChange={handleChange}
            onPaste={handlePaste}
            disabled={uploading}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="primary" disabled={uploading} style={{ flexShrink: 0 }}>
            Enviar
          </button>
        </>
      )}
    </form>
  );
}
