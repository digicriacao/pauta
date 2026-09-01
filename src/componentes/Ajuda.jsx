"use client";

import { useEffect, useRef, useState } from "react";
import { useAjuda } from "@/lib/ajuda";

/**
 * Modal das tabelas explicativas (Nº de peças e Esforço).
 *
 * Uma tela só serve às duas tabelas: o que muda entre elas é a configuração em
 * `lib/ajuda.js`. Para quem lê, é uma tabela. Para o admin, a mesma tabela com
 * os campos abertos — editar olhando o resultado é melhor do que editar num
 * formulário à parte e depois conferir.
 */

/** Campo que cresce com o texto: numa tabela de referência as frases são longas. */
function Campo({ valor, aoSalvar, linhas = 2, curto, numero, centro }) {
  const [txt, setTxt] = useState(valor ?? "");
  const [focado, setFocado] = useState(false);
  const ref = useRef(null);

  useEffect(() => { if (!focado) setTxt(valor ?? ""); }, [valor, focado]);

  useEffect(() => {
    const el = ref.current;
    if (!el || curto) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [txt, curto]);

  function salva() {
    const cru = String(txt).trim();
    const antes = valor === null || valor === undefined ? "" : String(valor);
    if (cru === antes) return;
    aoSalvar(numero ? (cru === "" ? null : Number(cru)) : cru);
  }

  const comuns = {
    ref,
    value: txt ?? "",
    className: `aj-in${centro ? " centro" : ""}`,
    onChange: (e) => setTxt(e.target.value),
    onFocus: () => setFocado(true),
    onBlur: () => { setFocado(false); salva(); },
    onKeyDown: (e) => {
      if (e.key === "Escape") { setTxt(valor ?? ""); e.currentTarget.blur(); }
      if (e.key === "Enter" && (curto || e.metaKey || e.ctrlKey)) e.currentTarget.blur();
    },
  };

  return curto
    ? <input {...comuns} type={numero ? "number" : "text"} inputMode={numero ? "numeric" : undefined} />
    : <textarea {...comuns} rows={linhas} />;
}

export default function Ajuda({ chave, ehAdmin, aoFechar, aviso }) {
  const { cfg, linhas, estado, salvar, incluir, remover, mover, semear } = useAjuda(chave);
  const [editando, setEditando] = useState(false);

  // Esc fecha, como em qualquer modal — menos enquanto se digita numa célula.
  useEffect(() => {
    const ouve = (e) => {
      if (e.key !== "Escape") return;
      const alvo = e.target;
      if (alvo && /^(INPUT|TEXTAREA)$/.test(alvo.tagName)) return;
      aoFechar();
    };
    window.addEventListener("keydown", ouve);
    return () => window.removeEventListener("keydown", ouve);
  }, [aoFechar]);

  if (!cfg) return null;

  const podeMexer = ehAdmin && editando && estado === "ok";
  const grade = cfg.colunas.map((c) => c.largura).join(" ") + (podeMexer ? " 72px" : "");

  async function tenta(promessa, oque) {
    const r = await promessa;
    if (r?.erro) aviso?.(`Não deu para ${oque}: ${r.erro}`);
  }

  return (
    <div className="mask on" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="foco aj" role="dialog" aria-modal="true" aria-label={cfg.titulo}>
        <div className="foco-h aj-h">
          <div>
            <span className="eyebrow">{cfg.icone} tabela de referência</span>
            <h2>{cfg.titulo}</h2>
          </div>
          <button className="x" onClick={aoFechar} aria-label="Fechar">×</button>
        </div>

        <p className="aj-resumo">{cfg.resumo}</p>

        {ehAdmin && (
          <div className="aj-barra">
            {estado === "ok" ? (
              <>
                <button className={`mini ${editando ? "on" : ""}`} onClick={() => setEditando(!editando)}>
                  {editando ? "✓ Concluir edição" : "✎ Editar tabela"}
                </button>
                {editando && (
                  <button className="mini" onClick={() => tenta(incluir(), "incluir a linha")}>
                    + Incluir linha
                  </button>
                )}
                <span className="aj-nota">
                  {editando
                    ? "O que você escrever é gravado ao sair do campo. Todo mundo vê a mesma tabela."
                    : "Você é admin: pode editar esta tabela."}
                </span>
              </>
            ) : (
              <>
                <button className="mini on" onClick={() => tenta(semear(), "criar as linhas")}>
                  ↧ Gravar esta tabela no banco
                </button>
                <span className="aj-nota">
                  {estado === "vazio"
                    ? "A tabela existe no banco mas está vazia — o que está na tela é o conteúdo padrão."
                    : "Ainda não achei esta tabela no banco. Mostrando o conteúdo padrão; rode o SQL para poder editar."}
                </span>
              </>
            )}
          </div>
        )}

        <div className="aj-rolo">
          <div className="aj-tab" style={{ "--cols": grade }}>
            <div className="aj-cab">
              {cfg.colunas.map((c) => (
                <span key={c.id} className={c.centro ? "centro" : ""}>{c.rotulo}</span>
              ))}
              {podeMexer && <span className="centro">Linha</span>}
            </div>

            {linhas.map((l, i) => (
              <div className="aj-lin" key={l.id}>
                {cfg.colunas.map((c) => (
                  <div key={c.id} className={`aj-cel${c.centro ? " centro" : ""}`}>
                    {podeMexer ? (
                      <Campo
                        valor={l[c.id]} linhas={c.linhas} curto={c.curto}
                        numero={c.numero} centro={c.centro}
                        aoSalvar={(v) => tenta(salvar(l.id, { [c.id]: v }), "salvar")}
                      />
                    ) : c.numero || c.centro ? (
                      <b className="mono">{l[c.id] ?? "—"}</b>
                    ) : (
                      <span>{l[c.id] || "—"}</span>
                    )}
                  </div>
                ))}

                {podeMexer && (
                  <div className="aj-cel centro aj-acoes">
                    <button className="aj-mv" disabled={i === 0}
                      title="Subir" onClick={() => mover(l.id, -1)}>↑</button>
                    <button className="aj-mv" disabled={i === linhas.length - 1}
                      title="Descer" onClick={() => mover(l.id, 1)}>↓</button>
                    <button className="aj-mv rm" title="Excluir linha"
                      onClick={() => tenta(remover(l.id), "excluir")}>×</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="aj-pe">
          <span>
            {linhas.length} {linhas.length === 1 ? "linha" : "linhas"}
            {estado !== "ok" && " · conteúdo padrão"}
          </span>
          <button className="btn" onClick={aoFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
