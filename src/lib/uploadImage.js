import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const BUCKET = "chat-files";

// Envia um arquivo (imagem ou áudio) direto do navegador para o Supabase
// Storage e devolve a URL pública para salvar na mensagem.
export async function uploadChatFile(file, conversationId) {
  const supabase = getSupabaseBrowserClient();

  const ext = file.name.split(".").pop() || "bin";
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;

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
