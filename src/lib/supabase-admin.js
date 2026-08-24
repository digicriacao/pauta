import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave de serviço: ignora RLS. Use APENAS em route handlers.
 * Se este arquivo for importado por um componente de cliente, o build quebra
 * de propósito — é a chave mais sensível do projeto.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Supabase não configurado (URL ou SERVICE_ROLE_KEY faltando)");
  return createClient(url, chave, { auth: { persistSession: false } });
}
