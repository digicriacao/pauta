"use client";

/**
 * Quem está na pauta agora, no canto do cabeçalho.
 * Mostra até quatro bichos e resume o resto num "+N"; a lista inteira sai no
 * balão ao passar o mouse. O "(você)" existe para a pessoa se reconhecer —
 * senão o apelido sorteado não diz nada a ninguém.
 */
export default function Presenca({ eu, gente }) {
  if (!gente.length) return null;

  const mostra = gente.slice(0, 4);
  const resto = gente.length - mostra.length;
  const lista = gente.map((p) => `${p.emoji} ${p.nome}${p.id === eu?.id ? " (você)" : ""}`).join("\n");

  return (
    <div className="pres" title={`Na pauta agora:\n${lista}`}>
      <span className="pres-n mono">{gente.length}</span>
      <div className="pres-avs">
        {mostra.map((p) => (
          <i key={p.id} className={`pres-av${p.id === eu?.id ? " eu" : ""}`}
            style={{ boxShadow: `inset 0 0 0 2px ${p.hex || "var(--none)"}` }}>
            {p.emoji}
          </i>
        ))}
        {resto > 0 && <i className="pres-av mais mono">+{resto}</i>}
      </div>
    </div>
  );
}
