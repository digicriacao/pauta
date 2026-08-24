/** Funções do Azure que rodam nos dois lados. Nada aqui toca o PAT. */

const ORG = process.env.NEXT_PUBLIC_AZURE_ORG || "digidevs";
const PROJETO = process.env.NEXT_PUBLIC_AZURE_PROJECT || "SQUAD PULSE";

export function urlCard(id) {
  return `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}/_workitems/edit/${id}`;
}

/** Aceita a URL colada, o id puro, ou qualquer texto que contenha o id. */
export function idDoLink(texto) {
  const m = String(texto || "").match(/(?:_workitems\/edit\/)?(\d{3,})/);
  return m ? Number(m[1]) : null;
}
