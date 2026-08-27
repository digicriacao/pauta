"use client";

import { useMemo, useState } from "react";
import { LS_LARGURAS, colunasFila } from "@/lib/constantes";
import { fmtBR } from "@/lib/formato";
import { urlCard } from "@/lib/azure-cliente";
import { useLarguras } from "@/lib/larguras";
import { Cabecalhos, Colunas } from "./GradeBase";

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}, var(--surface))`;

/**
 * Serve as duas áreas de exceção — Parados e Cancelados. Nenhuma das duas é
 * cópia da pauta: são a mesma tabela `pedidos`, filtrada pela marcação do
 * status interno. Por isso a linha aparece aqui sozinha no instante em que
 * alguém troca o status lá na home, e some se voltar atrás. A única coisa que
 * se escreve aqui é o motivo.
 *
 * `fila` vem de FILAS (constantes.js) e diz o que muda entre as duas: qual
 * marcação filtra, em que coluna o motivo é gravado e como a coluna se chama.
 */
export default function Fila({ fila, pedidos, cfg, podeEditar, salvar, aviso }) {
  const colunas = useMemo(() => colunasFila(fila), [fila]);
  const { larg, pegaBorda } = useLarguras(`${LS_LARGURAS}.${fila.chave}`);
  const [ordem, setOrdem] = useState({ campo: "data_solicitacao", dir: "desc" });
  const dis = !podeEditar;

  const aoOrdenar = (c) =>
    setOrdem((a) =>
      a.campo === c.ord
        ? { campo: c.ord, dir: a.dir === "asc" ? "desc" : "asc" }
        : { campo: c.ord, dir: c.dirPadrao || "asc" }
    );

  const nomeDem = (p) => cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome || "";

  const lista = useMemo(() => {
    const sinal = ordem.dir === "asc" ? 1 : -1;
    const chave = (p) =>
      ordem.campo === "demandante"
        ? cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome || ""
        : p[ordem.campo] || "";
    return pedidos.slice().sort((a, b) => {
      const va = chave(a);
      const vb = chave(b);
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      return String(va).localeCompare(String(vb), "pt", { numeric: true }) * sinal;
    });
  }, [pedidos, ordem, cfg.demandantes]);

  const total = colunas.reduce((s, c) => s + larg(c), 0);

  return (
    <div className="gridwrap">
      <table className="grade" style={{ minWidth: total, width: "100%" }}>
        <Colunas colunas={colunas} larg={larg} />
        <Cabecalhos colunas={colunas} larg={larg} pegaBorda={pegaBorda} ordem={ordem} aoOrdenar={aoOrdenar} />
        <tbody>
          {lista.map((p) => {
            const st = cfg.status.find((s) => s.id === p.status_interno_id);
            const cor = st?.cor || fila.cor;
            const motivo = p[fila.campoMotivo] || "";
            const semMotivo = !motivo.trim();
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
                  {nomeDem(p) ? <div className="ro">{nomeDem(p)}</div> : <div className="ro empty">—</div>}
                </td>
                <td><div className="ro" title={p.titulo || ""}>{p.titulo || <em>sem título</em>}</div></td>
                <td>
                  <span className="chipwrap">
                    <span className="chip fixo" style={{
                      background: mix(cor, "var(--chip-a)"),
                      color: cor,
                      boxShadow: `inset 0 0 0 1px ${mix(cor, "var(--chip-b)")}`,
                    }}>
                      {st?.nome || fila.botao}
                    </span>
                  </span>
                </td>
                <td>
                  <input className="cell" type="text" disabled={dis}
                    placeholder={semMotivo ? fila.dicaMotivo : "…"}
                    defaultValue={motivo} title={motivo}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v === motivo) return;
                      const r = await salvar(p.id, { [fila.campoMotivo]: v || null });
                      if (r?.erro) aviso(`Não deu para salvar o motivo: ${r.erro}`);
                    }} />
                </td>
              </tr>
            );
          })}

          {!lista.length && (
            <tr><td colSpan={colunas.length}>
              <div className="ro empty" style={{ height: 64 }}>{fila.vazio}</div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
