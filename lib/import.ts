import { normalizeDesc, parseBRL } from "@/lib/format";

export type ParsedRow = { date: string; description: string; amount: number; externalId: string };

function toISODate(raw: string): string | null {
  const s = raw.trim().replace(/"/g, "");
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{2})$/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function toAmount(raw: string): number {
  const s = raw.replace(/[−–]/g, "-").replace(/"/g, "").trim();
  if (!s) return NaN;
  const paren = /^\(.*\)$/.test(s);
  const n = parseBRL(paren ? s.slice(1, -1) : s);
  return paren ? -Math.abs(n) : n;
}

function parseOFX(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const get = (tag: string) => {
      const m = b.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const date = toISODate(get("DTPOSTED"));
    const amount = toAmount(get("TRNAMT").replace(",", "."));
    const description = get("MEMO") || get("NAME") || "Sem descrição";
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    rows.push({ date, description, amount, externalId: get("FITID") });
  }
  return rows;
}

function splitCSVLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === d && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const first = lines[0];
  const delim = [";", ",", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const table = lines.map((l) => splitCSVLine(l, delim));

  // linha de cabeçalho: a primeira que tem uma coluna de data e uma de valor
  const isDate = (h: string) => /^(data|date|dt)/i.test(h);
  const isValue = (h: string) => /(valor|amount|quantia|value)/i.test(h) && !/saldo/i.test(h);
  const isCredit = (h: string) => /(cr[eé]dito|entrada)/i.test(h);
  const isDebit = (h: string) => /(d[eé]bito|sa[ií]da)/i.test(h);
  let headerIdx = table.findIndex(
    (r) => r.some(isDate) && (r.some(isValue) || (r.some(isCredit) && r.some(isDebit))),
  );
  let iDate: number, iDesc: number, iVal: number, iCred = -1, iDeb = -1, iId = -1;
  if (headerIdx >= 0) {
    const h = table[headerIdx];
    iDate = h.findIndex(isDate);
    iVal = h.findIndex(isValue);
    iCred = h.findIndex(isCredit);
    iDeb = h.findIndex(isDebit);
    iId = h.findIndex((x) => /(identificador|^id$|fitid|documento)/i.test(x));
    iDesc = h.findIndex((x) => /(descri|hist[oó]rico|memo|detalhe|estabelecimento|title|t[ií]tulo|lan[cç]amento|nome)/i.test(x));
    if (iDesc < 0) iDesc = h.findIndex((_, i) => i !== iDate && i !== iVal && i !== iCred && i !== iDeb && i !== iId);
  } else {
    headerIdx = -1;
    iDate = 0; iDesc = 1; iVal = 2;
  }

  const rows: ParsedRow[] = [];
  for (const r of table.slice(headerIdx + 1)) {
    const date = toISODate(r[iDate] ?? "");
    let amount: number;
    if (iVal >= 0 && (r[iVal] ?? "") !== "") amount = toAmount(r[iVal]);
    else {
      const c = toAmount(r[iCred] ?? "");
      const d = toAmount(r[iDeb] ?? "");
      amount = (Number.isFinite(c) ? c : 0) - (Number.isFinite(d) ? Math.abs(d) : 0);
    }
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    rows.push({
      date,
      description: (r[iDesc] ?? "").replace(/\s+/g, " ").trim() || "Sem descrição",
      amount,
      externalId: iId >= 0 ? (r[iId] ?? "") : "",
    });
  }
  return rows;
}

/** Lê um extrato OFX ou CSV (formato brasileiro) e devolve as linhas com um id estável para evitar duplicatas. */
export function parseStatement(text: string, filename: string): ParsedRow[] {
  const isOFX = /\.ofx$/i.test(filename) || /<OFX>/i.test(text.slice(0, 2000)) || /<STMTTRN>/i.test(text);
  const rows = isOFX ? parseOFX(text) : parseCSV(text);

  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = r.externalId ? `id:${r.externalId}` : `k:${r.date}|${r.amount.toFixed(2)}|${normalizeDesc(r.description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...r, externalId: n > 1 ? `${base}#${n}` : base };
  });
}
