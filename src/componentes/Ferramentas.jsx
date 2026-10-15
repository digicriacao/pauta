"use client";

import { useEffect } from "react";

/**
 * As outras plataformas da Digi, num lugar só.
 *
 * É um atalho, não uma integração: cada uma é um sistema à parte, com login
 * próprio, e aqui só guardamos o endereço. Virou modal — e não uma lista de
 * quatro botões no cabeçalho — porque o cabeçalho já disputa cada pixel com o
 * grupo do meio, e porque nome e explicação cabem numa lista e não cabem num
 * ícone.
 *
 * Abre em guia nova, sempre: quem vai revisar um texto na Sof.ia não quer
 * perder a pauta que estava olhando.
 */
export const FERRAMENTAS = [
  {
    nome: "Sof.ia",
    icone: "✍️",
    oque: "Revisora de texto",
    detalhe: "Confere ortografia, gramática e o jeito de escrever da casa.",
    url: "https://digicriacao.github.io/revisor/",
  },
  {
    nome: "Otimizador",
    icone: "🖼️",
    oque: "Imagens e PDFs",
    detalhe: "Reduz o peso dos arquivos sem estragar a qualidade.",
    url: "https://digicriacao.github.io/otimizador/",
  },
  {
    nome: "Digi Réguas",
    icone: "📐",
    oque: "Réguas de posts",
    detalhe: "Monta a régua de publicações — o calendário do que sai e quando.",
    url: "https://reguas.digi.ag/",
  },
  {
    nome: "CriaDigi",
    icone: "🎨",
    oque: "Criação de artes",
    detalhe: "A plataforma de criação de peças da Digi.",
    url: "https://digicriacao.github.io/criadigi/",
  },
];

export default function Ferramentas({ aoFechar }) {
  // Esc fecha, como em qualquer modal da casa.
  useEffect(() => {
    const ouve = (e) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", ouve);
    return () => window.removeEventListener("keydown", ouve);
  }, [aoFechar]);

  return (
    <div className="mask on" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="foco fer" role="dialog" aria-modal="true" aria-label="Ferramentas da Digi">
        <div className="foco-h">
          <div>
            <span className="eyebrow">🧰 atalhos</span>
            <h2>Ferramentas da Digi</h2>
          </div>
          <button className="x" onClick={aoFechar} aria-label="Fechar">×</button>
        </div>

        <div className="fer-lista">
          {FERRAMENTAS.map((f) => (
            <a
              key={f.url}
              className="fer-item"
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${f.nome} — ${f.oque}. Abre em outra guia.`}
            >
              <span className="fer-ico" aria-hidden="true">{f.icone}</span>
              <span className="fer-txt">
                <b>{f.nome}</b>
                <span className="fer-oque">{f.oque}</span>
                <span className="fer-det">{f.detalhe}</span>
              </span>
              {/* A seta é o que diz "sai daqui" antes do clique, e não depois. */}
              <span className="fer-seta" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>

        <p className="fer-pe">
          Cada uma tem login próprio. Todas abrem em outra guia — a pauta continua aqui.
        </p>
      </div>
    </div>
  );
}
