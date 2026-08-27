/**
 * Transforma um link colado no nome do arquivo, como o Excel faz quando você
 * cola um documento do SharePoint numa célula.
 *
 * Cobre os três casos que aparecem no dia a dia:
 *   • card do Azure           → #51502
 *   • documento do SharePoint → Régua Junho.xlsx
 *   • pasta do SharePoint     → A51502_Ranking
 * Não reconhecendo nada, devolve o domínio — nunca a URL inteira, que estoura
 * a coluna.
 */

const EXT = /\.(docx?|xlsx?|pptx?|pdf|csv|txt|psd|ai|indd|eps|zip|rar|png|jpe?g|gif|svg|mp4|mov)$/i;

const decoda = (t) => {
  try { return decodeURIComponent(t); } catch { return t; }
};

/** Último pedaço do caminho, se ele parecer um arquivo. */
function arquivoEm(caminho) {
  const limpo = decoda(String(caminho).split("?")[0].split("#")[0]);
  const seg = limpo.split("/").filter(Boolean).pop() || "";
  return EXT.test(seg) ? seg : null;
}

export function nomeDoLink(url) {
  const bruto = String(url || "").trim();
  if (!bruto) return "";

  let u;
  try {
    u = new URL(comEsquema(bruto));
  } catch {
    return bruto.length > 42 ? `${bruto.slice(0, 40)}…` : bruto;
  }

  const card = u.pathname.match(/_workitems\/edit\/(\d+)/i);
  if (card) return `#${card[1]}`;

  // O SharePoint esconde o nome real em parâmetros diferentes conforme a rota.
  for (const chave of ["file", "id", "RootFolder", "sourcedoc"]) {
    const v = u.searchParams.get(chave);
    const nome = v && arquivoEm(v);
    if (nome) return nome;
  }

  const noCaminho = arquivoEm(u.pathname);
  if (noCaminho) return noCaminho;

  // Sem extensão: costuma ser pasta. O último pedaço serve, menos as páginas
  // .aspx do próprio SharePoint, que não dizem nada.
  const partes = decoda(u.pathname).split("/").filter(Boolean);
  const ultimo = partes[partes.length - 1] || "";
  if (ultimo && !/\.aspx$/i.test(ultimo) && !/^(sites|teams|personal|_layouts|15)$/i.test(ultimo)) {
    return ultimo;
  }
  return u.hostname.replace(/^www\./, "");
}

/** Aceita link colado sem esquema — senão `new URL` recusa e o href não abre. */
export const comEsquema = (url) => {
  const t = String(url || "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
