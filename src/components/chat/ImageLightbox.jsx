"use client";

import { useEffect } from "react";

const ARROW_BTN_STYLE = {
  position: "fixed",
  top: "50%",
  transform: "translateY(-50%)",
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "none",
  background: "rgba(255,255,255,0.15)",
  color: "white",
  fontSize: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

// Visualizador de imagem em tela cheia com navegação entre as fotos da
// conversa - seta pro lado (na tela ou com as setas do teclado) passa pra
// próxima/anterior, sem precisar fechar e clicar em outra foto.
export default function ImageLightbox({ images, index, onClose, onNavigate }) {
  const image = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  if (!image) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: "zoom-out",
      }}
    >
      <img
        src={image.fileUrl}
        alt="Imagem enviada no chat"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "92vw", maxHeight: "92vh", borderRadius: 8, objectFit: "contain", cursor: "default" }}
      />

      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          title="Foto anterior"
          style={{ ...ARROW_BTN_STYLE, left: 16 }}
        >
          ‹
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          title="Próxima foto"
          style={{ ...ARROW_BTN_STYLE, right: 16 }}
        >
          ›
        </button>
      )}

      {images.length > 1 && (
        <span
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.8)",
            fontSize: 13,
          }}
        >
          {index + 1} / {images.length}
        </span>
      )}

      <button
        onClick={onClose}
        title="Fechar"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.15)",
          color: "white",
          fontSize: 16,
        }}
      >
        ✕
      </button>
    </div>
  );
}
