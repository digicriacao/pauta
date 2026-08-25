"use client";

/**
 * Endereço das Edge Functions do Supabase — é o que substitui as rotas de
 * servidor que antes moravam na Vercel. Cada função vive em
 * https://SEU-PROJETO.supabase.co/functions/v1/NOME
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const urlFuncao = (nome) => `${URL_BASE}/functions/v1/${nome}`;

/**
 * Chama uma função. Sem sessão, manda a chave anônima — o Supabase exige um
 * token válido em toda chamada, e a anônima é pública de propósito.
 */
export async function chamaFuncao(nome, corpo, token) {
  const r = await fetch(urlFuncao(nome), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${token || ANON}`,
    },
    body: JSON.stringify(corpo || {}),
  });
  let dados = {};
  try {
    dados = await r.json();
  } catch {
    dados = { erro: "Resposta inválida da função." };
  }
  return { ok: r.ok, status: r.status, dados };
}
