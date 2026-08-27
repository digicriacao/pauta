"use client";

import { useMemo, useState } from "react";
import { COLUNAS_CANCELADOS, LS_LARGURAS } from "@/lib/constantes";
import { fmtBR } from "@/lib/formato";
import { urlCard } from "@/lib/azure-cliente";
import { useLarguras } from "@/lib/larguras";
import { Cabecalhos, Colunas } from "./GradeBase";

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}, var(--surface))`;

/**
 * Cancelados não é uma cópia da pauta: é a mesma tabela `pedidos`, filtrada
 * pelo status marcado como cancelamento. Por isso a linha aparece aqui sozinha
 * no instante em que alguém troca o status lá na home — e some se voltar atrás.
 * A única coisa que se escreve aqui é o motivo.
 */
export default function Cancelados({ pedidos, cfg, podeEditar, salvar, aviso }) {
  const { larg, pegaBorda } = useLarguras(`${LS_LARGURAS}.cancelados`);
  const [ordem, setOrdem] = useState({ campo: "data_solicitacao", dir: "desc" });
  const dis = !podeEditar;

  const aoOrdenar = (c) =>
    setOrdem((a) =>
      a.campo === c.ord ? { campo: c.ord, dir: a.dir === "asc" ? "desc" : "asc" } : { campo: c.ord, dir: c.dirPadrao || "asc" }
    );

  const nomeDem = (p) => cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome || "";

  const lista = useMemo(() => {
    const sinal = ordem.dir === "asc" ? 1 : -1;
    const chave = (p) => (ordem.campo === "demandante" ? nomeDem(p) : p[ordem.campo] || "");
    return pedidos.slice().sort((a, b) => {
      const va = chave(a);
      const vb = chave(b);
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      return String(va).localeCompare(String(vb), "pt", { numeric: true }) * sinal;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, ordem, cfg.demandantes]);

  const total = COLUNAS_CANCELADOS.reduce((s, c) => s + larg(c), 0);

  return (
    <div className="gridwrap">
      <table className="grade" style={{ minWidth: total, width: "100%" }}>
        <Colunas colunas={COLUNAS_CANCELADOS} larg={larg} />
        <Cabecalhos colunas={COLUNAS_CANCELADOS} larg={larg} pegaBorda={pegaBorda} ordem={ordem} aoOrdenar={aoOrdenar} />
        <tbody>
          {lista.map((p) => {
            const st = cfg.status.find((s) => s.id === p.status_interno_id);
            const cor = st?.cor || "#DC2626";
            const semMotivo = !(p.motivo_cancelamento || "").trim();
            return (
              <tr key={p.id} className={semMotivo ? "pendente" : ""}>
                <td>
                  {p.data_solicitacao
                    ? <div className="ro mono">{fmtBR(p.data_solicitacao)}</div>
                    : <div className="ro empty">—</div>}
                </td>
                <td>
                  {p.azure_id ? (
                    <span className="link">
                      <a href={urlCard(p.azure_id)} target="_blank" rel="noopener noreferrer">#{p.azure_id} ↗</a>
                    </span>
                  ) : (
                    <div className="ro empty">sem card</div>
                  )}
                </td>
                <td>
                  {nomeDem(p)
                    ? <div className="ro">{nomeDem(p)}</div>
                    : <div className="ro empty">—</div>}
                </td>
                <td><div className="ro" title={p.titulo || ""}>{p.titulo || <em>sem título</em>}</div></td>
                <td>
                  <span className="chipwrap">
                    <span className="chip fixo" style={{
                      background: mix(cor, "var(--chip-a)"),
                      color: cor,
                      boxShadow: `inset 0 0 0 1px ${mix(cor, "var(--chip-b)")}`,
                    }}>
                      {st?.nome || "CANCELADO"}
                    </span>
                  </span>
                </td>
                <td>
                  <input className="cell" type="text" disabled={dis}
                    placeholder={semMotivo ? "por que foi cancelado?" : "…"}
                    defaultValue={p.motivo_cancelamento || ""} title={p.motivo_cancelamento || ""}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v === (p.motivo_cancelamento || "")) return;
                      const r = await salvar(p.id, { motivo_cancelamento: v || null });
                      if (r?.erro) aviso(`Não deu para salvar o motivo: ${r.erro}`);
                    }} />
                </td>
              </tr>
            );
          })}

          {!lista.length && (
            <tr><td colSpan={COLUNAS_CANCELADOS.length}>
              <div className="ro empty" style={{ height: 64 }}>
                Nada cancelado. Um pedido chega aqui quando o status interno vira CANCELADO na pauta.
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
