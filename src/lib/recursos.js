/**
 * De-para entre o nome que vem do Azure e o apelido usado na pauta.
 *
 * O casamento não pode ser por igualdade: o Azure devolve o `displayName` da
 * conta, que quase sempre traz sobrenome ("Vinicius Silva"), acento ou caixa
 * diferente do que está cadastrado ("Vinicius"). Quando isso acontece a busca
 * exata falha e a grade acaba mostrando o nome comprido em vez do apelido.
 *
 * A regra aqui é: tenta o nome exato; não achando, aceita que um contenha o
 * outro. É o suficiente para "Vinicius Silva" cair em "Vinicius" → "Vini",
 * sem inventar parentesco entre pessoas de nomes diferentes.
 */

export const chaveNome = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function achaRecurso(recursos, nomeAzure) {
  const alvo = chaveNome(nomeAzure);
  if (!alvo || !recursos?.length) return null;
  return (
    recursos.find((r) => chaveNome(r.nome_azure) === alvo) ||
    recursos.find((r) => {
      const k = chaveNome(r.nome_azure);
      return k && (alvo.includes(k) || k.includes(alvo));
    }) ||
    null
  );
}

/** O nome que aparece na tela: apelido quando existe, nome do Azure quando não. */
export const nomeCurto = (recursos, nomeAzure) =>
  achaRecurso(recursos, nomeAzure)?.nome_pauta || nomeAzure || "";
