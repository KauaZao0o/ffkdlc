// Extrai o tipo (vídeo ou playlist) e o ID de qualquer formato de link do
// YouTube aceito: link normal, youtu.be, shorts, embed, ID de 11
// caracteres ou link/ID de playlist.
export function parseYoutubeInput(raw) {
  const input = (raw || "").trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return { type: "video", id: input };
  }

  let url = null;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    url = null;
  }

  if (url) {
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    const playlistId = url.searchParams.get("list");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (id) return { type: "video", id };
    }

    if (host === "youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        if (id) return { type: "video", id };
      }
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        if (id) return { type: "video", id };
      }
      if (url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/")[2];
        if (id) return { type: "video", id };
      }
    }

    if (playlistId) return { type: "playlist", id: playlistId };
  }

  // ID de playlist "cru" (sem link em volta) - costuma ser bem mais longo
  // que os 11 caracteres de um ID de vídeo.
  if (/^[a-zA-Z0-9_-]{12,}$/.test(input)) {
    return { type: "playlist", id: input };
  }

  return null;
}

// Título/autor de um vídeo ou playlist públicos, via oEmbed - não precisa
// de chave de API.
export async function fetchYoutubeInfo(parsed) {
  const url =
    parsed.type === "playlist"
      ? `https://www.youtube.com/playlist?list=${parsed.id}`
      : `https://www.youtube.com/watch?v=${parsed.id}`;

  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, author: data.author_name };
  } catch {
    return null;
  }
}
