"use client";

import { useEffect, useRef } from "react";
import { COLUNAS, COLUNAS_ESSENCIAIS } from "@/lib/constantes";

/**
 * Escolher quais colunas da grade aparecem.
 *
 * Mora no canto direito da barra, onde antes ficava o contador de pedidos. Ele
 * saiu porque a largura da barra é disputada e um número que ninguém usa para
 * decidir nada vale menos que um controle.
 *
 * A bolinha aparece SÓ quando há coluna escondida, e é de propósito: olhar uma
 * grade incompleta sem saber que ela está incompleta é como ler uma planilha
 * com coluna oculta — a pessoa jura que o dado sumiu. Com a bolinha, o motivo
 * está a um olhar de distância.
 */
export default function FiltroColunas({ visiveis, aoMudar, aberto, setAberto }) {
  const caixa = useRef(null);
  const menu = useRef(null);
  const escondidas = COLUNAS.length - visiveis.length;

  // Fecha ao clicar fora e no Esc — mesma regra do filtro de data.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto, setAberto]);

  /* O menu é ancorado pela DIREITA (`right:0`), e não pela esquerda como o de
     data: este controle vive no fim da barra, então abrir para a esquerda é o
     único jeito de ele nascer dentro da tela. */

  function alternar(id) {
    const col = COLUNAS.find((c) => c.id === id);
    if (col?.fixa) return;
    const tem = visiveis.includes(id);
    // Não deixa esconder a última: grade sem coluna nenhuma não é grade.
    if (tem && visiveis.length <= 1) return;
    aoMudar(tem ? visiveis.filter((v) => v !== id) : [...visiveis, id]);
  }

  return (
    <div className="fcol" ref={caixa}>
      <button
        type="button" className={`abtn ${escondidas ? "on" : ""}`}
        aria-expanded={aberto} aria-haspopup="true"
        title={escondidas
          ? `${escondidas} ${escondidas === 1 ? "coluna escondida" : "colunas escondidas"} — clique para escolher`
          : "Escolher quais colunas aparecem na grade"}
        onClick={() => setAberto((v) => !v)}
      >
        👁 colunas
        {escondidas > 0 && <span className="bolha am">{escondidas}</span>}
      </button>

      {aberto && (
        <div className="fcol-pop" role="menu" ref={menu}>
          <p className="fcol-tit">Colunas da grade</p>

          <div className="fcol-lista">
            {COLUNAS.map((c) => {
              const marcada = visiveis.includes(c.id);
              const travada = !!c.fixa || (marcada && visiveis.length <= 1);
              return (
                <label
                  key={c.id}
                  className={`fcol-item ${marcada ? "on" : ""} ${travada ? "travada" : ""}`}
                  title={c.fixa
                    ? "O pedido é o que identifica a linha — esta coluna não se esconde"
                    : c.dono === "azure" ? "Vem do card do Azure" : undefined}
                >
                  <input
                    type="checkbox" checked={marcada} disabled={travada}
                    onChange={() => alternar(c.id)}
                  />
                  <span className="fcol-nome">{c.nome}</span>
                  {c.fixa
                    ? <span className="fcol-fixa">sempre</span>
                    : c.dono === "azure" && <span className="fcol-dono">azure</span>}
                </label>
              );
            })}
          </div>

          <div className="fcol-pe">
            <button type="button" className="chipclear"
              onClick={() => aoMudar(COLUNAS.map((c) => c.id))}>
              mostrar todas
            </button>
            <button type="button" className="chipclear"
              onClick={() => aoMudar(COLUNAS_ESSENCIAIS.slice())}
              title="Cliente, pedido, entrega, status, recurso">
              só o essencial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
