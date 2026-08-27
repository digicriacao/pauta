"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Larguras de coluna arrastáveis, guardadas no navegador de cada pessoa.
 * As três grades (pauta, réguas, cancelados) usam este mesmo hook, cada uma
 * com sua chave — quem alarga a coluna "Régua" não mexe na pauta de ninguém.
 */
export function useLarguras(chave) {
  const [larguras, setLarguras] = useState({});
  const arraste = useRef(null);

  useEffect(() => {
    try { setLarguras(JSON.parse(localStorage.getItem(chave) || "{}") || {}); } catch {}
  }, [chave]);

  useEffect(() => {
    const move = (e) => {
      if (!arraste.current) return;
      const { id, x0, w0 } = arraste.current;
      setLarguras((l) => ({ ...l, [id]: Math.max(56, w0 + (e.clientX - x0)) }));
    };
    const solta = () => {
      if (!arraste.current) return;
      arraste.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setLarguras((l) => {
        try { localStorage.setItem(chave, JSON.stringify(l)); } catch {}
        return l;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", solta);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", solta);
    };
  }, [chave]);

  const larg = useCallback((c) => larguras[c.id] || c.largura, [larguras]);

  const pegaBorda = useCallback((e, c) => {
    e.preventDefault();
    e.stopPropagation();
    arraste.current = { id: c.id, x0: e.clientX, w0: larguras[c.id] || c.largura };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [larguras]);

  return { larg, pegaBorda };
}
