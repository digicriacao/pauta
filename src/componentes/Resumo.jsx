"use client";

import { rotuloMes } from "@/lib/formato";

export default function Resumo({ pedidos, mesSel, cfg }) {
  const n = pedidos.length || 1;
  const nomeStatus = (id) => cfg.status.find((s) => s.id === id)?.nome;
  const conta = (nome) => pedidos.filter((p) => nomeStatus(p.status_interno_id) === nome).length;
  const entregues = pedidos.filter((p) => p.entregue).length;
  const tipoAjuste = cfg.tipos.find((t) => /ajuste/i.test(t.nome))?.id;
  const ajustes = pedidos.filter((p) => p.tipo_id === tipoAjuste).length;

  const linhas = [
    ["Pedidos no mês", pedidos.length, `${rotuloMes(mesSel)} · linhas na pauta`],
    ["Em produção", conta("PRODUÇÃO"), "ainda com o time"],
    ["Aguardando aprovação", conta("ENVIADO PARA APROVAÇÃO") + conta("AGUARDANDO APROVAÇÃO INTERNA"), "parados esperando alguém"],
    ["Entregues", entregues, `${Math.round((entregues / n) * 100)}% do mês`],
    ["Sem card no Azure", pedidos.filter((p) => !p.azure_id).length, "sem link colado"],
    ["Ajustes", ajustes, `${Math.round((ajustes / n) * 100)}% dos pedidos`],
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
