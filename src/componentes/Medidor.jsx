"use client";

import { useMemo } from "react";
import { hojeISO } from "@/lib/formato";
import { achaRecurso } from "@/lib/recursos";

/** Entrega marcada para hoje — pela hora combinada, ou pela data do card. */
function ehDeHoje(p, hoje) {
  const dia = p.entrega_em ? new Date(p.entrega_em).toISOString().slice(0, 10) : p.data_entrega;
  return dia === hoje;
}

/**
 * Quanto esforço cada pessoa tem marcado para hoje.
 *
 * Quem aparece aqui sai do cadastro de Recursos, no Admin — a caixinha
 * "medidor" de cada linha. Assim entra e sai gente sem mexer em código.
 *
 * Cada célula traz o número (o fato) sobre uma barra fininha proporcional a
 * quem tem mais no dia (o contraste). Quem está zerado continua na lista: a
 * ausência de carga é justamente o que se quer enxergar de relance.
 */
export default function Medidor({ pedidos, cfg }) {
  const linhas = useMemo(() => {
    const hoje = hojeISO();
    const doDia = pedidos.filter((p) => ehDeHoje(p, hoje));
    const escolhidos = (cfg.recursos || []).filter((r) => r.medidor);

    return escolhidos.map((r) => {
      const meus = doDia.filter((p) => achaRecurso(escolhidos, p.azure_assigned_to)?.id === r.id);
      return {
        nome: r.nome_pauta || r.nome_azure,
        esforco: meus.reduce((s, p) => s + (Number(p.esforco) || 0), 0),
        pedidos: meus.length,
      };
    });
  }, [pedidos, cfg.recursos]);

  const max = Math.max(1, ...linhas.map((l) => l.esforco));
  const total = linhas.reduce((s, l) => s + l.esforco, 0);

  return (
    <aside className="medidor">
      <div className="med-h">
        <span className="k">Esforço de hoje</span>
        <span className="med-total mono">{total}</span>
      </div>

      {linhas.length ? (
        <div className="med-cels">
          {linhas.map((l) => (
            <div className={`med-cel${l.esforco ? "" : " vazio"}`} key={l.nome}
              title={`${l.nome}: ${l.esforco} de esforço em ${l.pedidos} ${l.pedidos === 1 ? "pedido" : "pedidos"} com entrega hoje`}>
              <span className="med-num mono">{l.esforco}</span>
              <span className="med-nome">{l.nome}</span>
              <span className="med-tri"><i style={{ width: `${(l.esforco / max) * 100}%` }} /></span>
            </div>
          ))}
        </div>
      ) : (
        <p className="med-sem">Ninguém marcado. Escolha em <b>Admin → Recursos</b>.</p>
      )}
    </aside>
  );
}
