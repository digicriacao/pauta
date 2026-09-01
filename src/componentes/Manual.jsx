"use client";

import { useEffect, useMemo, useState } from "react";
import { MANUAL, GRUPOS_MANUAL, textoDoTopico, chave } from "@/lib/manual";
import { BASE } from "@/lib/constantes";

/**
 * O manual da plataforma. Página própria, aberta em guia nova, para que dê
 * para consultar com a pauta aberta do lado.
 *
 * A busca é sem acento e sem caixa, e filtra o manual inteiro: quem procura
 * "pecas" acha "peças" e vê só os tópicos que falam disso, com o termo
 * grifado. Sem resultado, a tela diz o que fazer em vez de ficar em branco.
 */

/** Grifa o termo procurado sem se importar com acento nem com maiúscula. */
function realce(texto, q) {
  const alvo = chave(q);
  if (!alvo) return texto;

  const letras = [...texto];
  let norm = "";
  const mapa = [];
  letras.forEach((c, i) => {
    const n = chave(c) || c.toLowerCase();
    for (let k = 0; k < n.length; k++) mapa.push(i);
    norm += n;
  });

  const saida = [];
  let de = 0;
  let achou = norm.indexOf(alvo);
  let n = 0;
  while (achou !== -1) {
    const ini = mapa[achou];
    const fim = mapa[achou + alvo.length - 1] + 1;
    if (ini > de) saida.push(letras.slice(de, ini).join(""));
    saida.push(<mark key={`m${n++}`}>{letras.slice(ini, fim).join("")}</mark>);
    de = fim;
    achou = norm.indexOf(alvo, achou + alvo.length);
  }
  saida.push(letras.slice(de).join(""));
  return saida;
}

function Bloco({ bloco, q }) {
  const [tipo, conteudo] = bloco;
  if (tipo === "p") return <p>{realce(conteudo, q)}</p>;
  if (tipo === "nota") return <p className="man-nota">{realce(conteudo, q)}</p>;
  if (tipo === "ul") return <ul>{conteudo.map((li, i) => <li key={i}>{realce(li, q)}</li>)}</ul>;
  if (tipo === "ol") return <ol>{conteudo.map((li, i) => <li key={i}>{realce(li, q)}</li>)}</ol>;
  if (tipo === "tab") {
    const [cab, ...linhas] = conteudo;
    return (
      <div className="man-tabrolo">
        <table className="man-tab">
          <thead><tr>{cab.map((c, i) => <th key={i}>{realce(c, q)}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>{l.map((c, j) => <td key={j}>{realce(c, q)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function Manual() {
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(MANUAL[0].id);

  const achados = useMemo(() => {
    const alvo = chave(q.trim());
    if (!alvo) return MANUAL;
    return MANUAL.filter((t) => chave(textoDoTopico(t)).includes(alvo));
  }, [q]);

  // O índice acompanha a rolagem: sem isso, num manual comprido a pessoa
  // perde a noção de onde está.
  useEffect(() => {
    const alvos = achados.map((t) => document.getElementById(`t-${t.id}`)).filter(Boolean);
    if (!alvos.length) return;
    const obs = new IntersectionObserver(
      (ev) => {
        const visivel = ev.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtivo(visivel.target.id.slice(2));
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    alvos.forEach((a) => obs.observe(a));
    return () => obs.disconnect();
  }, [achados]);

  // "/" põe o cursor na busca, como em quase todo lugar que tem busca.
  useEffect(() => {
    const ouve = (e) => {
      if (e.key !== "/" || /^(INPUT|TEXTAREA)$/.test(e.target?.tagName)) return;
      e.preventDefault();
      document.getElementById("man-busca")?.focus();
    };
    window.addEventListener("keydown", ouve);
    return () => window.removeEventListener("keydown", ouve);
  }, []);

  const gruposVisiveis = GRUPOS_MANUAL.filter((g) => achados.some((t) => t.grupo === g));

  return (
    <div className="man">
      <header className="man-topo">
        <div className="man-wrap man-hrow">
          <a className="man-marca" href={`${BASE}/`}>
            <img className="logo logo-light" src={`${BASE}/logo-rosa.png`} alt="Digi" width="90" height="25" />
            <img className="logo logo-dark" src={`${BASE}/logo-claro.png`} alt="Digi" width="90" height="25" />
          </a>
          <div className="man-tit">
            <b>Manual da Pauta</b>
            <span>como a plataforma funciona, tópico por tópico</span>
          </div>
          <input
            id="man-busca" className="man-busca" type="search"
            placeholder="Buscar no manual…   (tecle /)"
            value={q} onChange={(e) => setQ(e.target.value)}
          />
          <a className="man-voltar" href={`${BASE}/`}>← Voltar à pauta</a>
        </div>
      </header>

      <div className="man-wrap man-corpo">
        <nav className="man-indice" aria-label="Índice">
          {q.trim() && (
            <p className="man-cont">
              {achados.length
                ? `${achados.length} ${achados.length === 1 ? "tópico" : "tópicos"} com “${q.trim()}”`
                : "nada encontrado"}
            </p>
          )}
          {gruposVisiveis.map((g) => (
            <div className="man-gr" key={g}>
              <h3>{g}</h3>
              <ul>
                {achados.filter((t) => t.grupo === g).map((t) => (
                  <li key={t.id}>
                    <a className={ativo === t.id ? "on" : ""} href={`#t-${t.id}`}>{t.titulo}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="man-texto">
          {achados.length === 0 && (
            <section className="man-card">
              <h2>Não achei nada com “{q.trim()}”</h2>
              <p>
                Tente uma palavra mais curta, ou o nome do que você está vendo na tela —
                “fura-fila”, “régua”, “esforço”, “cancelado”. Se o assunto não estiver
                aqui, vale pedir para incluírem.
              </p>
              <button className="btn" onClick={() => setQ("")}>Limpar a busca</button>
            </section>
          )}

          {achados.map((t) => (
            <section className="man-topico" id={`t-${t.id}`} key={t.id}>
              <span className="man-grupo">{t.grupo}</span>
              <h2>{realce(t.titulo, q.trim())}</h2>
              {t.corpo.map((b, i) => <Bloco key={i} bloco={b} q={q.trim()} />)}
            </section>
          ))}

          <footer className="man-pe">
            Manual da Pauta v2 · mantido pela Digi. Achou algo errado ou faltando? Avise —
            este texto é editado junto com a plataforma.
          </footer>
        </main>
      </div>
    </div>
  );
}
