"use client";

import { useMemo, useState } from "react";
import { COLUNAS_REGUAS, LS_LARGURAS, STATUS_REGUA, corRegua, posRegua } from "@/lib/constantes";
import { nomeDoLink, comEsquema } from "@/lib/links";
import { useLarguras } from "@/lib/larguras";
import { Cabecalhos, Colunas, CampoTexto } from "./GradeBase";

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}, var(--surface))`;

/** Link vira o nome do arquivo, como no Excel. O ✎ ao lado troca o endereço. */
function CampoLink({ valor, aoMudar, desabilitado }) {
  const [editando, setEditando] = useState(false);

  if (valor && !editando) {
    return (
      <span className="link">
        <a href={comEsquema(valor)} target="_blank" rel="noopener noreferrer" title={valor}>
          {nomeDoLink(valor)}
        </a>
        {!desabilitado && (
          <button className="mini" title="Trocar o link" onClick={() => setEditando(true)}>✎</button>
        )}
      </span>
    );
  }

  return (
    <span className="link">
      <input
        className="paste" placeholder="Colar link" disabled={desabilitado}
        autoFocus={editando} defaultValue={valor || ""}
        onBlur={(e) => {
          setEditando(false);
          const v = e.target.value.trim();
          if (v !== (valor || "")) aoMudar(v || null);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
    </span>
  );
}

function ChipStatus({ valor, aoMudar, desabilitado }) {
  const item = STATUS_REGUA.find((s) => s.id === valor);
  const cor = item?.cor || "var(--none)";
  return (
    <span className="chipwrap">
      <select
        className="chip" value={valor || ""} disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.value || "radar")}
        style={{
          background: item ? mix(cor, "var(--chip-a)") : "transparent",
          color: item ? cor : "var(--faint)",
          boxShadow: `inset 0 0 0 1px ${item ? mix(cor, "var(--chip-b)") : "var(--line-strong)"}`,
        }}
      >
        {STATUS_REGUA.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
    </span>
  );
}

export default function Reguas({ reguas, clientes = [], podeEditar, salvar, criar, remover, aviso }) {
  const { larg, pegaBorda } = useLarguras(`${LS_LARGURAS}.reguas`);
  const [ordem, setOrdem] = useState({ campo: null, dir: "asc" });
  const [nova, setNova] = useState("");
  const dis = !podeEditar;

  const aoOrdenar = (c) =>
    setOrdem((a) =>
      a.campo === c.ord ? { campo: c.ord, dir: a.dir === "asc" ? "desc" : "asc" } : { campo: c.ord, dir: c.dirPadrao || "asc" }
    );

  const lista = useMemo(() => {
    if (!ordem.campo) return reguas;
    const sinal = ordem.dir === "asc" ? 1 : -1;
    const chave = (r) =>
      ordem.campo === "status" ? posRegua(r.status) : r[ordem.campo] || "";
    return reguas.slice().sort((a, b) => {
      const va = chave(a);
      const vb = chave(b);
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt", { numeric: true });
      return cmp * sinal;
    });
  }, [reguas, ordem]);

  const guarda = async (fn, oq) => {
    const r = await fn();
    if (r?.erro) aviso(`Não deu para ${oq}: ${r.erro}`);
  };

  const total = COLUNAS_REGUAS.reduce((s, c) => s + larg(c), 0);

  return (
    <div className="gridwrap">
      <datalist id="clientes-pauta">
        {clientes.map((c) => <option key={c} value={c} />)}
      </datalist>
      <table className="grade" style={{ minWidth: total, width: "100%" }}>
        <Colunas colunas={COLUNAS_REGUAS} larg={larg} />
        <Cabecalhos colunas={COLUNAS_REGUAS} larg={larg} pegaBorda={pegaBorda} ordem={ordem} aoOrdenar={aoOrdenar} />
        <tbody>
          <tr className="novo">
            <td />
            <td>
              <input
                className="novo-pedido" placeholder="Nova régua" disabled={dis} value={nova}
                onChange={(e) => setNova(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const v = nova.trim();
                  if (!v) return;
                  setNova("");
                  guarda(() => criar(v), "criar a régua");
                }}
                title="Escreva o nome da régua e aperte Enter."
              />
            </td>
            <td /><td /><td />
          </tr>

          {lista.map((r) => (
            <tr key={r.id}>
              <td>
                {/* Régua não tem card: o cliente é escrito à mão, com sugestão
                    dos nomes que já existem na pauta. */}
                <CampoTexto valor={r.cliente} desabilitado={dis} placeholder="cliente" lista="clientes-pauta"
                  aoSalvar={(v) => guarda(() => salvar(r.id, { cliente: v }), "salvar o cliente")} />
              </td>
              <td>
                <CampoTexto valor={r.nome} desabilitado={dis} placeholder="nome da régua"
                  aoSalvar={(v) => guarda(() => salvar(r.id, { nome: v }), "salvar")} />
              </td>
              <td>
                <CampoLink valor={r.link} desabilitado={dis}
                  aoMudar={(v) => guarda(() => salvar(r.id, { link: v }), "salvar o link")} />
              </td>
              <td>
                <ChipStatus valor={r.status} desabilitado={dis}
                  aoMudar={(v) => guarda(() => salvar(r.id, { status: v }), "trocar o status")} />
              </td>
              <td>
                <CampoTexto valor={r.observacao} desabilitado={dis} placeholder="…"
                  aoSalvar={(v) => guarda(() => salvar(r.id, { observacao: v }), "salvar")} />
              </td>
              <td>
                <button className="del" disabled={dis} title="Remover régua"
                  onClick={() => guarda(() => remover(r.id), "remover")}>×</button>
              </td>
            </tr>
          ))}

          {!lista.length && (
            <tr><td colSpan={COLUNAS_REGUAS.length}>
              <div className="ro empty" style={{ height: 64 }}>
                Nenhuma régua ainda. Escreva o nome na primeira linha e aperte Enter.
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
