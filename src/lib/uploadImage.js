import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const BUCKET = "chat-files";

// Envia a imagem direto do navegador para o Supabase Storage e devolve a
// URL pública para salvar na mensagem.
export async function uploadChatImage(file, conversationId) {
  const supabase = getSupabaseBrowserClient();

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
