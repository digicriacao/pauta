"use client";

import { rotuloMes } from "@/lib/formato";

export default function Resumo({ pedidos, mesSel, cfg }) {
  const n = pedidos.length || 1;
  const nomeStatus = (id) => cfg.status.find((s) => s.id === id)?.nome;
  const conta = (nome) => pedidos.filter((p) => nomeStatus(p.status_interno_id) === nome).length;
  const entregues = pedidos.filter((p) => p.entregue);
  // Artes já feitas no mês: só o que está marcado como entregue conta.
  const artes = entregues.reduce((s, p) => s + (p.qtd_artes ?? 0), 0);
  const artesTotal = pedidos.reduce((s, p) => s + (p.qtd_artes ?? 0), 0);

  const linhas = [
    ["Pedidos no mês", pedidos.length, `${rotuloMes(mesSel)} · linhas na pauta`],
    ["Em produção", conta("PRODUÇÃO"), "ainda com o time"],
    ["Aguardando aprovação", conta("ENVIADO PARA APROVAÇÃO") + conta("AGUARDANDO APROVAÇÃO INTERNA"), "parados esperando alguém"],
    ["Entregues", entregues.length, `${Math.round((entregues.length / n) * 100)}% do mês`],
    ["Artes no mês", artes, `de ${artesTotal} previstas`],
  ];

  return (
    <div className="kpis">
      {linhas.map(([k, v, s]) => (
        <div className="kpi" key={k}>
          <span className="k">{k}</span>
          <span className="v">{v}</span>
          <span className="s">{s}</span>
        </div>
      ))}
    </div>
  );
}
