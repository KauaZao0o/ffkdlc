"use client";

import { useEffect, useState } from "react";
import { getPreferredMic, setPreferredMic, getPreferredSpeaker, setPreferredSpeaker } from "@/lib/callDevices";

// `live` = true quando aberto durante uma chamada em andamento (aplica a
// troca na hora, sem desligar); false quando é só ajustar a preferência
// pra próxima chamada.
export default function CallAudioSettingsModal({ onClose, live = false, onMicChange, onSpeakerChange }) {
  const [mics, setMics] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedMic, setSelectedMic] = useState(getPreferredMic());
  const [selectedSpeaker, setSelectedSpeaker] = useState(getPreferredSpeaker());
  const [supportsSpeakerSwitch, setSupportsSpeakerSwitch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stream;

    async function load() {
      try {
        // Pede permissão brevemente só pra revelar os nomes dos aparelhos
        // (sem isso o navegador mostra só "Microfone 1", "Microfone 2"...).
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Sem permissão - segue só com o que der pra listar mesmo assim.
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      setMics(devices.filter((d) => d.kind === "audioinput"));
      setSpeakers(devices.filter((d) => d.kind === "audiooutput"));
      setSupportsSpeakerSwitch(
        typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype
      );
      stream?.getTracks().forEach((t) => t.stop());
      setLoading(false);
    }

    load();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function handleMicChange(e) {
    const id = e.target.value;
    setSelectedMic(id);
    setPreferredMic(id);
    onMicChange?.(id);
  }

  function handleSpeakerChange(e) {
    const id = e.target.value;
    setSelectedSpeaker(id);
    setPreferredSpeaker(id);
    onSpeakerChange?.(id);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", color: "var(--text)", borderRadius: 12, padding: 24, width: 320, maxWidth: "85vw" }}
      >
        <h3 style={{ marginTop: 0 }}>Áudio e som</h3>

        {loading ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Carregando dispositivos...</p>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
              Microfone
            </label>
            <select value={selectedMic} onChange={handleMicChange} style={{ width: "100%", marginBottom: 16 }}>
              <option value="">Padrão do sistema</option>
              {mics.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microfone ${i + 1}`}
                </option>
              ))}
            </select>

            <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
              Alto-falante
            </label>
            {supportsSpeakerSwitch ? (
              <select value={selectedSpeaker} onChange={handleSpeakerChange} style={{ width: "100%" }}>
                <option value="">Padrão do sistema</option>
                {speakers.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Alto-falante ${i + 1}`}
                  </option>
                ))}
              </select>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
                Esse navegador não deixa escolher o alto-falante por aqui - use as configurações de som do próprio
                aparelho.
              </p>
            )}

            {live && (
              <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
                Aplicado na hora, sem cortar a ligação.
              </p>
            )}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="primary" onClick={onClose}>
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
