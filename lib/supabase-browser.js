"use client";

import { createBrowserClient } from "@supabase/ssr";

let cliente = null;

/** Singleton do Supabase no navegador. Só usa a anon key — RLS manda no resto. */
export function supabase() {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return null;
  cliente = createBrowserClient(url, chave);
  return cliente;
}
