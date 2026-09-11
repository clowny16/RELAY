/* Data engine — worker-safe. CSV/TSV/JSON/JSONL/YAML/TOML/XML/INI/XLSX. */
import type { ConvertContext, ConversionResultPayload } from "../types";

let PapaMod: typeof import("papaparse") | null = null;
async function papa() {
  if (!PapaMod) PapaMod = await import("papaparse");
  return PapaMod;
}
let yamlMod: typeof import("js-yaml") | null = null;
async function yml() {
  if (!yamlMod) yamlMod = await import("js-yaml");
  return yamlMod;
}
let tomlMod: typeof import("smol-toml") | null = null;
async function tomlLib() {
  if (!tomlMod) tomlMod = await import("smol-toml");
  return tomlMod;
}
let fxmlMod: typeof import("fast-xml-parser") | null = null;
async function fxml() {
  if (!fxmlMod) fxmlMod = await import("fast-xml-parser");
  return fxmlMod;
}
let xlsxMod: typeof import("xlsx") | null = null;
async function xlsxLib() {
  if (!xlsxMod) xlsxMod = await import("xlsx");
  return xlsxMod;
}

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8");

export function decodeText(buffer: ArrayBuffer): string {
  return dec.decode(buffer).replace(/^\uFEFF/, "");
}

type Row = Record<string, unknown>;

/* ---------------- table helpers ---------------- */

function toRows(records: unknown[]): { rows: string[][]; header: string[] } {
  if (records.length === 0) return { rows: [], header: [] };
  const first = records[0];
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return { rows: records.map((r) => [String(r)]), header: ["value"] };
  }
  const keys = new Set<string>();
  for (const rec of records) {
    if (typeof rec === "object" && rec !== null) Object.keys(rec as object).forEach((k) => keys.add(k));
  }
  const header = [...keys];
  const rows = records.map((rec) =>
    header.map((k) => {
      const v = (rec as Row)[k];
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    })
  );
  return { rows, header };
}

function csvEscape(v: string, delimiter: string, quote: string): string {
  const needs = v.includes(delimiter) || v.includes(quote) || v.includes("\n") || v.includes("\r");
  return needs ? quote + v.replace(new RegExp(quote, "g"), quote + quote) + quote : v;
}

function serializeTable(header: string[], rows: string[][], delimiter: string, quote: string): string {
  const head = header.map((h) => csvEscape(h, delimiter, quote)).join(delimiter);
  const body = rows.map((r) => r.map((c) => csvEscape(c, delimiter, quote)).join(delimiter));
  return [head, ...body].join("\n");
}

/* ---------------- parsers ---------------- */

async function parseDelimited(text: string, opts: Record<string, unknown>, defaultDelim: string): Promise<{ records: unknown[]; fields: string[] }> {
  const Papa = await papa();
  const delimOpt = String(opts.delimiter ?? defaultDelim);
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter: delimOpt === "auto" ? "" : delimOpt,
    quoteChar: String(opts.quote ?? '"'),
  });
  const raw = result.data;
  if (raw.length === 0) return { records: [], fields: [] };
  const hasHeader = opts.header !== false;
  if (hasHeader) {
    const fields = raw[0].map((h, i) => (String(h).trim() || `column_${i + 1}`));
    const records = raw.slice(1).map((row) => {
      const o: Row = {};
      fields.forEach((f, i) => {
        const v = row[i] ?? "";
        o[f] = coerceCell(v);
      });
      return o;
    });
    return { records, fields };
  }
  return { records: raw, fields: [] };
}

function coerceCell(v: string): unknown {
  const t = v.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t) && t.length < 16) return Number(t);
  return v;
}

function parseJsonRecords(text: string): unknown[] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  return [data];
}

async function parseXmlRecords(text: string): Promise<unknown> {
  const { XMLParser } = await fxml();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true, trimValues: true });
  return parser.parse(text);
}

function parseIni(text: string): Row {
  const out: Row = {};
  let section: Row | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      section = {};
      out[sec[1].trim()] = section;
      continue;
    }
    const kv = line.match(/^([^=]+)=(.*)$/);
    if (kv) {
      const key = kv[1].trim();
      const value = coerceCell(kv[2].trim());
      if (section) section[key] = value;
      else out[key] = value;
    }
  }
  return out;
}

/* ---------------- serializers ---------------- */

async function serializeXlsx(rows: string[][], header: string[], sheetName = "Sheet1"): Promise<Uint8Array> {
  const XLSX = await xlsxLib();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Uint8Array(out);
}

async function jsonToCsvText(data: unknown[], opts: Record<string, unknown>): Promise<string> {
  const { rows, header } = toRows(data);
  const delim = String(opts.delimiter ?? ",") === "auto" ? "," : String(opts.delimiter ?? ",");
  return serializeTable(header.length ? header : ["value"], rows, delim, String(opts.quote ?? '"'));
}

async function dataToXlsx(data: unknown[]): Promise<Uint8Array> {
  const { rows, header } = toRows(data);
  return serializeXlsx(rows, header.length ? header : ["value"]);
}

function toTomlCompatible(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  for (const v of Object.values(value as Row)) {
    if (v !== null && (typeof v === "object" || typeof v === "string" || typeof v === "number" || typeof v === "boolean")) continue;
    return false;
  }
  return true;
}

/* ---------------- main entry ---------------- */

export async function convertData(ctx: ConvertContext, buffer: ArrayBuffer): Promise<ConversionResultPayload> {
  const { inputFormat, outputFormat, options, onProgress } = ctx;
  const text = ["xlsx", "parquet", "avro", "sqlite"].includes(inputFormat) ? "" : decodeText(buffer);
  onProgress({ progress: 0.25, stage: "processing", detail: `Parsing ${inputFormat.toUpperCase()}…` });

  /* ---- parse input into a canonical structure ---- */
  let records: unknown[] = [];
  let rootObj: unknown = null;
  let fields: string[] = [];
  let tableRows: { rows: string[][]; header: string[] } | null = null;

  switch (inputFormat) {
    case "csv":
    case "tsv": {
      const r = await parseDelimited(text, options, inputFormat === "tsv" ? "\t" : ",");
      records = r.records;
      fields = r.fields;
      break;
    }
    case "json":
      rootObj = JSON.parse(text);
      records = Array.isArray(rootObj) ? rootObj : [rootObj];
      break;
    case "jsonl":
    case "ndjson":
      records = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
      break;
    case "yaml": {
      const y = await yml();
      rootObj = y.load(text, { schema: y.JSON_SCHEMA });
      records = Array.isArray(rootObj) ? rootObj : [rootObj];
      break;
    }
    case "toml": {
      const t = await tomlLib();
      rootObj = t.parse(text);
      records = [rootObj];
      break;
    }
    case "xml": {
      rootObj = await parseXmlRecords(text);
      records = [rootObj];
      break;
    }
    case "ini":
      rootObj = parseIni(text);
      records = [rootObj];
      break;
    case "xlsx": {
      const XLSX = await xlsxLib();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const headerRow = String(options.header ?? true) !== "false" && options.header !== false;
      records = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true, header: headerRow ? undefined : 1 });
      if (!headerRow && Array.isArray(records) && records.length && Array.isArray(records[0])) {
        const head = (records[0] as unknown[]).map(String);
        records = (records as unknown[][]).slice(1).map((r) => {
          const o: Row = {};
          head.forEach((h, i) => (o[h] = r[i]));
          return o;
        });
      }
      break;
    }
    default:
      throw new Error(`${inputFormat.toUpperCase()} parsing is not supported in-browser.`);
  }

  onProgress({ progress: 0.55, stage: "processing", detail: `Serializing ${outputFormat.toUpperCase()}…` });
  const pretty = options.pretty !== false;

  /* ---- serialize to output ---- */
  let bytes: Uint8Array;
  let mime: string;
  let textPreview: string | undefined;

  switch (outputFormat) {
    case "json": {
      const value = Array.isArray(rootObj) && rootObj.length ? rootObj : records.length === 1 ? records[0] : records;
      const out = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
      bytes = enc.encode(out);
      mime = "application/json";
      textPreview = out.slice(0, 2000);
      break;
    }
    case "jsonl": {
      const lines = (Array.isArray(rootObj) ? rootObj : records).map((r) => JSON.stringify(r));
      const out = lines.join("\n");
      bytes = enc.encode(out);
      mime = "application/jsonl";
      textPreview = out.slice(0, 2000);
      break;
    }
    case "csv":
    case "tsv": {
      let out: string;
      if (inputFormat === "csv" || inputFormat === "tsv") {
        // re-serialize parsed table
        const Papa = await papa();
        const hasHeader = options.header !== false;
        const delim = outputFormat === "tsv" ? "\t" : String(options.delimiter ?? ",") === "auto" ? "," : String(options.delimiter ?? ",");
        const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: "greedy", delimiter: inputFormat === "tsv" ? "\t" : delimOpt(options.delimiter) });
        const raw = parsed.data;
        if (hasHeader && raw.length) {
          out = serializeTable(raw[0].map((h, i) => String(h).trim() || `column_${i + 1}`), raw.slice(1), delim, String(options.quote ?? '"'));
        } else {
          out = raw.map((row) => row.map((c) => csvEscape(String(c), delim, String(options.quote ?? '"'))).join(delim)).join("\n");
        }
      } else {
        out = await jsonToCsvText(records, { delimiter: outputFormat === "tsv" ? "\t" : options.delimiter ?? ",", quote: options.quote });
      }
      bytes = enc.encode(out);
      mime = outputFormat === "tsv" ? "text/tab-separated-values" : "text/csv";
      textPreview = out.slice(0, 2000);
      break;
    }
    case "xlsx": {
      if (records.length && typeof records[0] === "object" && records[0] !== null) {
        bytes = await dataToXlsx(records);
        const { rows, header } = toRows(records);
        tableRows = { rows: rows.slice(0, 5), header };
      } else {
        bytes = await dataToXlsx([{ value: records }]);
      }
      mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      break;
    }
    case "yaml": {
      const y = await yml();
      const value = records.length === 1 && !Array.isArray(rootObj) ? rootObj : Array.isArray(rootObj) ? rootObj : records;
      const out = y.dump(value, { schema: y.JSON_SCHEMA, indent: pretty ? 2 : 0, lineWidth: 120 });
      bytes = enc.encode(out);
      mime = "application/yaml";
      textPreview = out.slice(0, 2000);
      break;
    }
    case "toml": {
      const t = await tomlLib();
      const value = rootObj !== null && !Array.isArray(rootObj) ? rootObj : records[0];
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        if (!toTomlCompatible(value)) throw new Error("TOML requires an object at the root (no arrays/tables of ambiguous nesting).");
      }
      const out = t.stringify(value as Row);
      bytes = enc.encode(out);
      mime = "application/toml";
      textPreview = out.slice(0, 2000);
      break;
    }
    case "xml": {
      const { XMLBuilder } = await fxml();
      const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_", format: pretty, indentBy: "  ", suppressEmptyNode: true });
      const root = Array.isArray(rootObj) ? { items: { item: rootObj } } : rootObj;
      const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(root);
      bytes = enc.encode(out);
      mime = "application/xml";
      textPreview = out.slice(0, 2000);
      break;
    }
    default:
      throw new Error(`${outputFormat.toUpperCase()} serialization is not supported in-browser.`);
  }

  const meta: Record<string, unknown> = {};
  if (fields.length) meta.columns = fields.length;
  if (records.length) meta.rows = records.length;
  if (tableRows) {
    meta.previewRows = tableRows.rows;
    meta.previewHeader = tableRows.header;
  } else if (records.length && typeof records[0] === "object" && records[0] !== null) {
    const { rows, header } = toRows(records.slice(0, 5));
    meta.previewRows = rows;
    meta.previewHeader = header;
  }

  return { bytes, mime, ext: outputFormat, textPreview, meta };
}

function delimOpt(d: unknown): string {
  const v = String(d ?? "auto");
  return v === "auto" ? "" : v;
}
