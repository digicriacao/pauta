/** Funções do Azure que rodam nos dois lados. Nada aqui toca o PAT. */

const ORG = process.env.NEXT_PUBLIC_AZURE_ORG || "digidevs";
const PROJETO = process.env.NEXT_PUBLIC_AZURE_PROJECT || "SQUAD PULSE";

/**
 * ┌─ CONFIRA ESTES DOIS ─────────────────────────────────────────────────┐
 * │ TIPO_CARD é o tipo de work item que vocês abrem para um pedido —     │
 * │ o tipo customizado de vocês, não o "Task" padrão do Azure.           │
 * │                                                                       │
 * │ O nome exato está em: Azure DevOps → Project Settings → Process →    │
 * │ (o processo do projeto) → lista de WORK ITEM TYPES. Copie o nome     │
 * │ como está escrito lá, com acento e maiúsculas iguais.                │
 * │ (O cabeçalho do formulário mostra "NEW CRIAÇÃO" tudo em maiúscula    │
 * │  por causa do estilo da página — não é o nome real.)                 │
 * │                                                                       │
 * │ CAMPO_CLIENTE preenche o campo Campanha já com o nome do cliente.    │
 * │ Deixe vazio para não preencher nada além do título.                  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
const TIPO_CARD = "Criação";
const CAMPO_CLIENTE = "";

export function urlCard(id) {
  return `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}/_workitems/edit/${id}`;
}

/** Aceita a URL colada, o id puro, ou qualquer texto que contenha o id. */
export function idDoLink(texto) {
  const m = String(texto || "").match(/(?:_workitems\/edit\/)?(\d{3,})/);
  return m ? Number(m[1]) : null;
}

/**
 * Abre o formulário de card novo já com o título preenchido.
 * O Azure aceita valores iniciais como parâmetros no formato
 * `[ReferenceName]=valor` — está na documentação de templates do Azure Boards.
 * O nome do tipo vai codificado: sem isso, o "ç" e o "ã" quebram a URL.
 */
export function urlNovoCard(titulo, cliente) {
  const tipo = encodeURIComponent(TIPO_CARD);
  const base = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}/_workItems/create/${tipo}`;
  const partes = [];
  if (titulo) partes.push(`[System.Title]=${encodeURIComponent(titulo)}`);
  if (CAMPO_CLIENTE && cliente) partes.push(`[${CAMPO_CLIENTE}]=${encodeURIComponent(cliente)}`);
  return partes.length ? `${base}?${partes.join("&")}` : base;
}
