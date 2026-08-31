"use client";

import { useMemo } from "react";
import { hojeISO } from "@/lib/formato";
import { achaRecurso } from "@/lib/recursos";
import { ESFORCO_DIA } from "@/lib/constantes";

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

  // A barra é percentual de um dia cheio, não do colega mais carregado: dez de
  // esforço enche. Assim "meia barra" quer dizer sempre a mesma coisa, hoje e
  // no mês que vem — comparar com o vizinho não diria nada sobre capacidade.
  const total = linhas.reduce((s, l) => s + l.esforco, 0);
  const pct = (v) => Math.min(100, (v / ESFORCO_DIA) * 100);

  return (
    <aside className="medidor">
      <div className="med-h">
        <span className="k">Esforço de hoje</span>
        <span className="med-esc mono" title={`Cada barra enche em ${ESFORCO_DIA} — um dia cheio`}>escala {ESFORCO_DIA}</span>
        <span className="med-total mono">{total}</span>
      </div>

      {linhas.length ? (
        <div className="med-cels">
          {linhas.map((l) => (
            <div className={`med-cel${l.esforco ? "" : " vazio"}${l.esforco > ESFORCO_DIA ? " estourou" : ""}`} key={l.nome}
              title={`${l.nome}: ${l.esforco} de esforço em ${l.pedidos} ${l.pedidos === 1 ? "pedido" : "pedidos"} com entrega hoje` +
                     ` — ${Math.round((l.esforco / ESFORCO_DIA) * 100)}% de um dia cheio (${ESFORCO_DIA})`}>
              <span className="med-num mono">{l.esforco}</span>
              <span className="med-nome">{l.nome}</span>
              <span className="med-tri"><i style={{ width: `${pct(l.esforco)}%` }} /></span>
            </div>
          ))}
        </div>
      ) : (
        <p className="med-sem">Ninguém marcado. Escolha em <b>Admin → Recursos</b>.</p>
      )}
    </aside>
  );
}
