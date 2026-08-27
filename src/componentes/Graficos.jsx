"use client";

import { PALETA } from "@/lib/constantes";

/**
 * As formas dos relatórios. Todas seguem as mesmas regras: marca fina, eixo
 * discreto, rótulo direto em vez de número em cima de tudo, e um espaço de 2px
 * entre segmentos vizinhos — é esse respiro que separa duas cores parecidas
 * para quem não distingue bem vermelho e verde.
 */

export const Legenda = ({ itens, cores }) => (
  <div className="legend">
    {itens.map((t, i) => (
      <span key={t}><i style={{ background: cores[i] || PALETA[6] }} />{t}</span>
    ))}
  </div>
);

/** Barras verticais — uma coluna por dia. */
export function BarrasV({ dados, alt = 180, dica, unidade = "pedido" }) {
  const max = Math.max(1, ...dados.map((d) => d.v));
  return (
    <div className="vchart" style={{ "--alt": `${alt}px` }}>
      <div className="veixo">
        <span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span>
      </div>
      <div className="vcols">
        {dados.map((d) => (
          <div className="colb" key={d.rot}
            onMouseMove={(e) => dica(
              `${d.rot} · <b>${d.v}</b> ${d.v === 1 ? unidade : `${unidade}s`}` +
              (d.entregues !== undefined ? ` · ${d.entregues} entregue${d.entregues === 1 ? "" : "s"}` : ""), e)}
            onMouseLeave={() => dica(null)}>
            <span className="vb">{d.v >= max * 0.7 ? d.v : ""}</span>
            <span className="bb" style={{ height: `${Math.max(2, (d.v / max) * 100)}%` }} />
            <span className="lb">{d.curto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontais — uma linha por categoria. */
export function BarrasH({ dados, cores, dica, unidade = "" }) {
  const total = dados.reduce((s, d) => s + d.v, 0) || 1;
  const max = Math.max(1, ...dados.map((d) => d.v));
  return (
    <div className="hlist">
      {dados.map((d, i) => (
        <div className="brow" key={d.rot}
          onMouseMove={(e) => dica(`${d.rot} · <b>${d.v}</b>${unidade ? ` ${unidade}` : ""} · ${Math.round((d.v / total) * 100)}%`, e)}
          onMouseLeave={() => dica(null)}>
          <span className="hlab">{d.rot}</span>
          <span className="hbar">
            <i style={{ background: cores[i] || PALETA[6], width: `${Math.max(1.5, (d.v / max) * 100)}%` }} />
          </span>
          <span className="mono hnum">
            {d.v}<span style={{ color: "var(--faint)" }}> · {Math.round((d.v / total) * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Uma barra só, dividida em partes — a leitura mais rápida de "como foi o mês".
 * O número de cada fatia fica na lista logo abaixo, não dentro da barra: assim
 * a cor nunca carrega o dado sozinha e nenhum rótulo depende do contraste da
 * fatia em que caiu.
 */
export function BarraSituacao({ partes, dica }) {
  const total = partes.reduce((s, d) => s + d.v, 0) || 1;
  const visiveis = partes.filter((d) => d.v > 0);
  return (
    <>
      <div className="sitbar">
        {visiveis.map((d) => (
          <span key={d.rot} className="sitseg"
            style={{ background: d.cor, width: `${(d.v / total) * 100}%` }}
            onMouseMove={(e) => dica(`${d.rot} · <b>${d.v}</b> · ${Math.round((d.v / total) * 100)}%`, e)}
            onMouseLeave={() => dica(null)} />
        ))}
      </div>
      <div className="sitlist">
        {partes.map((d) => (
          <span key={d.rot} className="sititem">
            <i style={{ background: d.cor }} />
            <b>{d.v}</b> {d.rot}
            <em>{Math.round((d.v / total) * 100)}%</em>
          </span>
        ))}
      </div>
    </>
  );
}

/** Barras horizontais empilhadas — duas séries somadas por linha. */
export function BarrasEmpilhadas({ linhas, series, dica }) {
  const max = Math.max(1, ...linhas.map((l) => l.valores.reduce((s, v) => s + v, 0)));
  return (
    <div className="hlist">
      {linhas.map((l) => {
        const total = l.valores.reduce((s, v) => s + v, 0);
        return (
          <div className="brow" key={l.rot}>
            <span className="hlab">{l.rot}</span>
            <span className="hbar">
              <span className="pilha" style={{ width: `${Math.max(2, (total / max) * 100)}%` }}>
                {l.valores.map((v, i) =>
                  v > 0 ? (
                    <i key={series[i].nome}
                      style={{ background: series[i].cor, flex: v }}
                      onMouseMove={(e) => dica(`${l.rot} · ${series[i].nome} · <b>${v}</b>`, e)}
                      onMouseLeave={() => dica(null)} />
                  ) : null
                )}
              </span>
            </span>
            <span className="mono hnum">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Duas curvas acumuladas na mesma escala: o previsto e o que já saiu.
 * A distância entre elas é o que falta — é o gráfico que responde "vamos
 * fechar o mês?" sem ninguém precisar somar nada.
 */
export function LinhaAcumulada({ dados, dica }) {
  if (dados.length < 2) return <p className="nada">Poucos dias com entrega para desenhar a curva.</p>;

  // Caixa larga e baixa de propósito: o cartão ocupa a linha inteira, e um
  // viewBox quadrado viraria um gráfico de meia tela de altura.
  const L = 46, R = 14, T = 14, B = 30, W = 1240, H = 250;
  const max = Math.max(1, ...dados.map((d) => d.previsto));
  const px = (i) => L + (i / (dados.length - 1)) * (W - L - R);
  const py = (v) => T + (1 - v / max) * (H - T - B);
  const caminho = (campo) => dados.map((d, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(d[campo]).toFixed(1)}`).join(" ");
  const area = `${caminho("entregue")} L${px(dados.length - 1).toFixed(1)},${py(0)} L${px(0).toFixed(1)},${py(0)} Z`;
  const marcas = [0, Math.round(max / 2), max];
  const passo = Math.ceil(dados.length / 8);

  return (
    <svg className="gr-linha" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entregas acumuladas no recorte">
      {marcas.map((m) => (
        <g key={m}>
          <line x1={L} x2={W - R} y1={py(m)} y2={py(m)} className="gr-grid" />
          <text x={L - 7} y={py(m) + 3.5} className="gr-txt" textAnchor="end">{m}</text>
        </g>
      ))}
      {dados.map((d, i) =>
        i % passo === 0 ? (
          <text key={d.rot} x={px(i)} y={H - 8} className="gr-txt" textAnchor="middle">{d.curto}</text>
        ) : null
      )}
      <path d={area} className="gr-area" />
      <path d={caminho("previsto")} className="gr-prev" />
      <path d={caminho("entregue")} className="gr-feito" />
      {dados.map((d, i) => (
        <rect key={d.rot} x={px(i) - (W - L - R) / (dados.length - 1) / 2} y={T}
          width={(W - L - R) / (dados.length - 1)} height={H - T - B} fill="transparent"
          onMouseMove={(e) => dica(`${d.rot} · previsto <b>${d.previsto}</b> · entregue <b>${d.entregue}</b>`, e)}
          onMouseLeave={() => dica(null)} />
      ))}
    </svg>
  );
}
