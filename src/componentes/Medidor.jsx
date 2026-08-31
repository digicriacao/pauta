"use client";

import { useMemo } from "react";
import { MEDIDOR_RECURSOS } from "@/lib/constantes";
import { hojeISO } from "@/lib/formato";

/** "Vinícius" e "vinicius" são a mesma pessoa. */
const chave = (t) =>
  String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Entrega marcada para hoje — pela hora combinada, ou pela data do card. */
function ehDeHoje(p, hoje) {
  const dia = p.entrega_em ? new Date(p.entrega_em).toISOString().slice(0, 10) : p.data_entrega;
  return dia === hoje;
}

/**
 * Quanto esforço cada uma das quatro pessoas tem marcado para hoje.
 * O esforço vem do card; a barra é relativa a quem tem mais no dia, e o
 * número ao lado é o valor absoluto — a barra dá o contraste, o número dá o
 * fato. Quem está sem nada aparece igual, com zero: some da lista seria pior,
 * porque a ausência é justamente o que se quer enxergar.
 */
export default function Medidor({ pedidos, cfg }) {
  const linhas = useMemo(() => {
    const hoje = hojeISO();
    const doDia = pedidos.filter((p) => ehDeHoje(p, hoje));

    return MEDIDOR_RECURSOS.map((nome) => {
      const alvo = chave(nome);
      // Casa tanto pelo nome do Azure quanto pelo apelido da pauta.
      const apelidos = cfg.recursos
        .filter((r) => chave(r.nome_azure).includes(alvo) || alvo.includes(chave(r.nome_pauta)))
        .map((r) => chave(r.nome_azure));
      const meus = doDia.filter((p) => {
        const az = chave(p.azure_assigned_to);
        return az && (az.includes(alvo) || apelidos.some((a) => a && az.includes(a)));
      });
      return {
        nome,
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
      <div className="med-lista">
        {linhas.map((l) => (
          <div className="med-row" key={l.nome}
            title={`${l.nome}: ${l.esforco} de esforço em ${l.pedidos} ${l.pedidos === 1 ? "pedido" : "pedidos"} com entrega hoje`}>
            <span className="med-nome">{l.nome}</span>
            <span className="med-tri">
              <i className={l.esforco ? "" : "zero"} style={{ width: `${(l.esforco / max) * 100}%` }} />
            </span>
            <span className="med-num mono">{l.esforco}</span>
          </div>
        ))}
      </div>
      <span className="med-pe">soma do esforço dos cards com entrega hoje</span>
    </aside>
  );
}
