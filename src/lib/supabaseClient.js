import { createClient } from "@supabase/supabase-js";

// Client "público" (chave anon) usado só no navegador, exclusivamente
// para o Realtime (mensagens novas e indicador de "digitando...").
// Toda escrita no banco continua passando pelas rotas de API, que usam
// o Prisma - o Supabase aqui não tem permissão de escrita, só de leitura
// dos eventos de replicação e broadcast.
let browserClient = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return browserClient;
}
