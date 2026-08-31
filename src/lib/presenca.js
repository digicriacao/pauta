"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Quem está com a pauta aberta agora.
 *
 * Ninguém precisa estar logado para aparecer — a presença anda pelo Realtime
 * do Supabase, com a chave pública. Por isso a identidade é um apelido sorteado
 * no estilo do Google Drive ("Raposa âmbar"), guardado no navegador: a mesma
 * pessoa volta com o mesmo bicho, e ninguém precisa se identificar para ser
 * contada.
 */

const ANIMAIS = [
  ["Urso", "🐻"], ["Pássaro", "🐦"], ["Raposa", "🦊"], ["Coruja", "🦉"],
  ["Lobo", "🐺"], ["Tigre", "🐯"], ["Tartaruga", "🐢"], ["Golfinho", "🐬"],
  ["Abelha", "🐝"], ["Sapo", "🐸"], ["Panda", "🐼"], ["Leão", "🦁"],
  ["Gato", "🐱"], ["Polvo", "🐙"], ["Pinguim", "🐧"], ["Cavalo", "🐴"],
  ["Borboleta", "🦋"], ["Lagarto", "🦎"], ["Caranguejo", "🦀"], ["Baleia", "🐳"],
  ["Esquilo", "🐿️"], ["Ouriço", "🦔"], ["Lontra", "🦦"], ["Arara", "🦜"],
];

/* Cores nomeadas pelo que se vê — nada de "branco" que some no tema claro. */
const CORES = [
  ["verde", "#059669"], ["azul", "#2563EB"], ["rosa", "#EA0356"], ["âmbar", "#D97706"],
  ["roxo", "#7C3AED"], ["turquesa", "#0891B2"], ["laranja", "#EA580C"], ["cinza", "#8C8494"],
];

const CHAVE = "pauta.v2.eu";

function sorteia() {
  const [nome, emoji] = ANIMAIS[Math.floor(Math.random() * ANIMAIS.length)];
  const [cor, hex] = CORES[Math.floor(Math.random() * CORES.length)];
  return {
    id: Math.random().toString(36).slice(2, 10),
    nome: `${nome} ${cor}`,
    emoji,
    hex,
  };
}

/** Uma identidade por navegador, estável entre recarregamentos. */
function identidade() {
  if (typeof window === "undefined") return null;
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (salvo?.id && salvo?.nome) return salvo;
  } catch {}
  const nova = sorteia();
  try { localStorage.setItem(CHAVE, JSON.stringify(nova)); } catch {}
  return nova;
}

export function usePresenca() {
  const [eu, setEu] = useState(null);
  const [gente, setGente] = useState([]);

  // Só no navegador: o localStorage não existe na geração da página.
  useEffect(() => { setEu(identidade()); }, []);

  useEffect(() => {
    const sb = supabase();
    if (!sb || !eu) return;

    const canal = sb.channel("pauta-presenca", { config: { presence: { key: eu.id } } });

    const junta = () => {
      const estado = canal.presenceState();
      const porId = new Map();
      Object.values(estado).flat().forEach((p) => {
        if (p?.id) porId.set(p.id, p);
      });
      setGente([...porId.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt")));
    };

    canal
      .on("presence", { event: "sync" }, junta)
      .on("presence", { event: "join" }, junta)
      .on("presence", { event: "leave" }, junta)
      .subscribe(async (situacao) => {
        if (situacao === "SUBSCRIBED") await canal.track(eu);
      });

    return () => { sb.removeChannel(canal); };
  }, [eu]);

  return useMemo(() => ({ eu, gente }), [eu, gente]);
}
