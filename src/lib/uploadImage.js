import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const BUCKET = "chat-files";

// Envia um arquivo (imagem, áudio ou documento) direto do navegador para o
// Supabase Storage e devolve a URL pública para salvar na mensagem.
export async function uploadChatFile(file, conversationId) {
  const supabase = getSupabaseBrowserClient();

  // Guarda o nome original (sanitizado) junto no caminho do arquivo, assim
  // dá pra mostrar "relatorio.pdf" pro usuário sem precisar de uma coluna
  // nova no banco - o nome vem embutido na própria URL pública.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "arquivo";
  const path = `${conversationId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Mantido por compatibilidade com código que já importava esse nome.
export const uploadChatImage = uploadChatFile;
