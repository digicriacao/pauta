/** Formatação e datas. Tudo em UTC dos dois lados — o Brasil é UTC-3 e um
 *  new Date("2026-08-03") local já nasce um dia atrasado. */

export const NOME_MES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const fmtBR = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "");
export const fmtBRL = (iso) =>
  iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";

export function diffDias(a, b) {
  if (!a || !b) return null;
  const d = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(b) - d(a)) / 86400000);
}

/** O dia em que a coisa é entregue. A hora combinada manda quando existe,
 *  porque é ela que a equipe de fato acertou; sem ela, vale a data do card.
 *  É a mesma conta que a página do cliente faz. */
export const diaDeEntrega = (p) =>
  p?.entrega_em ? paraInputLocal(p.entrega_em).slice(0, 10) : (p?.data_entrega || null);

/** Soma dias a uma data ISO. Em UTC, senão o horário de verão come um dia. */
export function somaDias(iso, n) {
  if (!iso) return null;
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

/** A semana que contém esta data, de SEGUNDA a DOMINGO — que é como a equipe
 *  fala de semana, e não o domingo-a-sábado do calendário americano. */
export function semanaDe(iso) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  const recuo = (d.getUTCDay() + 6) % 7;          // segunda vira 0
  return { de: somaDias(iso, -recuo), ate: somaDias(iso, 6 - recuo) };
}

/** Em que aba o pedido cai. Quem manda é a ENTREGA do card: pedido que entrega
 *  em setembro aparece em setembro, mesmo tendo sido pedido em agosto. A
 *  solicitação só entra como desempate quando o card ainda não tem entrega. */
export const mesDe = (p) => (p.data_entrega || p.data_solicitacao || "").slice(0, 7);

/** '2026-08' -> 'AGO' */
export const rotuloMes = (ym) => NOME_MES[Number(ym.slice(5, 7)) - 1];

/** Lista de meses ao redor do mês corrente, para as abas do topo. */
export function mesesDoAno(mesAtual, antes = 4, depois = 1) {
  const [a, m] = mesAtual.split("-").map(Number);
  const saida = [];
  for (let i = -antes; i <= depois; i++) {
    const d = new Date(Date.UTC(a, m - 1 + i, 1));
    saida.push(d.toISOString().slice(0, 7));
  }
  return saida;
}

/** datetime-local <-> timestamptz, sempre no fuso de quem está olhando.
 *  Antes isto fatiava o texto cru e mostrava a hora em UTC — três horas à
 *  frente do que a pessoa tinha digitado. */
export const paraInputLocal = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const deInputLocal = (v) => (v ? new Date(v).toISOString() : null);

/** '2026-06-24T15:30' -> '24/06 15:30'. Sem ano: a aba do mês já diz qual é. */
export const fmtDataHora = (ts) => {
  const v = paraInputLocal(ts);
  return v ? `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 16)}` : "";
};

export const csvCampo = (v) => {
  const t = String(v ?? "");
  return /[;"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
