"use client";

import { useEffect, useRef, useState } from "react";
import { fmtBR, fmtDataHora, paraInputLocal } from "@/lib/formato";

/**
 * Peças que as três grades (pauta, réguas, cancelados) dividem: o cabeçalho
 * clicável/redimensionável e o campo de data curto.
 */

export function Cabecalhos({ colunas, larg, pegaBorda, ordem, aoOrdenar }) {
  return (
    <thead>
      <tr>
        {colunas.map((c, i) => {
          const ativa = c.ord && ordem?.campo === c.ord;
          const dica = [c.dica, c.ord ? "clique para ordenar" : null].filter(Boolean).join(" · ");
          return (
            <th
              key={c.id}
              className={`${c.dono === "azure" ? "az" : ""} ${c.ord ? "ord" : ""}`}
              aria-sort={ativa ? (ordem.dir === "asc" ? "ascending" : "descending") : undefined}
              title={dica || undefined}
              onClick={() => c.ord && aoOrdenar?.(c)}
            >
              {c.rotulo}
              {ativa && <span className="seta">{ordem.dir === "asc" ? "▲" : "▼"}</span>}
              {i < colunas.length - 1 && (
                <span className="rz" onMouseDown={(e) => pegaBorda(e, c)} />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export function Colunas({ colunas, larg }) {
  return (
    <colgroup>
      {colunas.map((c) => <col key={c.id} style={{ width: larg(c) }} />)}
    </colgroup>
  );
}

/**
 * Data sem o ano. O input nativo insiste em mostrar o ano — então a célula
 * parada é texto, e o input só aparece (com o calendário aberto) no clique.
 * `hora` troca para data + hora combinada.
 */
export function CampoData({ valor, aoMudar, desabilitado, hora = false, titulo }) {
  const [editando, setEditando] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!editando || !ref.current) return;
    ref.current.focus();
    // Abre o calendário direto; onde o navegador não deixa, o foco já basta.
    try { ref.current.showPicker?.(); } catch {}
  }, [editando]);

  const texto = hora ? fmtDataHora(valor) : fmtBR(valor);

  if (desabilitado || !editando) {
    return (
      <button
        type="button"
        className={`data${texto ? "" : " vazio"}`}
        disabled={desabilitado}
        title={titulo || (texto ? "Clique para trocar" : "Clique para escolher")}
        onClick={() => setEditando(true)}
      >
        {texto || "—"}
      </button>
    );
  }

  return (
    <input
      ref={ref}
      className="cell"
      type={hora ? "datetime-local" : "date"}
      value={hora ? paraInputLocal(valor) : valor || ""}
      onChange={(e) => aoMudar(e.target.value)}
      onBlur={() => setEditando(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") setEditando(false);
      }}
    />
  );
}
