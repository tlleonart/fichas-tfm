/**
 * `convex/schema.ts` → diagrama ER en Mermaid (`erDiagram`), determinista.
 *
 * NO se dibuja a mano: se parsea el schema y se emite. Volver a correrlo después
 * de cada cambio de schema y pegar la salida en la doc de schema.
 *
 * Uso:
 *   node scripts/schema-to-mermaid.mjs [ruta/schema.ts] > salida.mmd
 *
 * Alcance del parser (suficiente para este schema; falla ruidosamente si no):
 *   - `nombre: defineTable({ ... })` con `.index("nombre", ["campo", ...])`
 *   - campos de primer nivel `clave: v.<tipo>(...)`, con `v.optional(...)`
 *   - FK por `v.id("tabla")` → relación 1:N desde la tabla referenciada
 *   - `v.union(v.literal("a"), v.literal("b"))` → se rotula como enum
 */

import fs from "node:fs";
import path from "node:path";

const schemaPath = process.argv[2] ?? path.join(process.cwd(), "convex", "schema.ts");
const src = fs.readFileSync(schemaPath, "utf8");

/** Quita comentarios de línea y de bloque sin tocar el contenido de los strings. */
function stripComments(s) {
  let out = "";
  let i = 0;
  let inStr = null;
  while (i < s.length) {
    const c = s[i];
    const n = s[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += s[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Devuelve el índice del carácter que cierra el balanceo abierto en `open`. */
function matchBracket(s, open) {
  const pairs = { "(": ")", "{": "}", "[": "]" };
  const close = pairs[s[open]];
  let depth = 0;
  let inStr = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if (c === s[open]) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Bracket sin cerrar en ${open}`);
}

/** Parte una lista por comas de primer nivel. */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let inStr = null;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      cur += c;
      if (c === "\\") {
        cur += body[++i] ?? "";
      } else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      cur += c;
      continue;
    }
    if ("({[".includes(c)) depth++;
    if (")}]".includes(c)) depth--;
    if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const clean = stripComments(src);

/* ── tablas ─────────────────────────────────────────────────────────────── */

const tables = [];
const tableRe = /(\w+)\s*:\s*defineTable\s*\(/g;
let m;
while ((m = tableRe.exec(clean)) !== null) {
  const name = m[1];
  const openParen = clean.indexOf("(", m.index + m[0].length - 1);
  const closeParen = matchBracket(clean, openParen);
  const openBrace = clean.indexOf("{", openParen);
  const closeBrace = matchBracket(clean, openBrace);
  const fieldsBody = clean.slice(openBrace + 1, closeBrace);

  // Cola de la definición: los .index(...) van después del ) de defineTable.
  const tailEnd = (() => {
    const rest = clean.slice(closeParen);
    const stop = rest.search(/\n\s*\w+\s*:\s*defineTable|\}\s*\)\s*;?\s*$/);
    return closeParen + (stop === -1 ? rest.length : stop);
  })();
  const tail = clean.slice(closeParen, tailEnd);

  const fields = [];
  for (const part of splitTopLevel(fieldsBody)) {
    const fm = part.match(/^(\w+)\s*:\s*([\s\S]+)$/);
    if (!fm) continue;
    const [, key, rawType] = fm;
    const optional = /^v\.optional\s*\(/.test(rawType.trim());
    const inner = optional
      ? rawType.trim().replace(/^v\.optional\s*\(/, "").replace(/\)\s*,?\s*$/, "").trim()
      : rawType.trim();
    const fkMatch = inner.match(/^v\.id\s*\(\s*["'](\w+)["']\s*\)/);
    let type;
    if (fkMatch) type = `Id_${fkMatch[1]}`;
    else if (/^v\.union/.test(inner)) {
      const lits = [...inner.matchAll(/v\.literal\s*\(\s*["']([^"']+)["']\s*\)/g)].map((x) => x[1]);
      type = lits.length ? `enum_${lits.join("_")}` : "union";
    } else if (/^v\.array/.test(inner)) type = "array";
    else if (/^v\.object/.test(inner)) type = "object";
    else {
      const t = inner.match(/^v\.(\w+)/);
      type = t ? t[1] : "unknown";
    }
    fields.push({ key, type, optional, fk: fkMatch ? fkMatch[1] : null });
  }

  const indexes = [...tail.matchAll(/\.index\s*\(\s*["']([^"']+)["']\s*,\s*\[([^\]]*)\]\s*\)/g)].map(
    (im) => ({
      name: im[1],
      fields: [...im[2].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]),
    }),
  );
  const searchIndexes = [
    ...tail.matchAll(/\.searchIndex\s*\(\s*["']([^"']+)["']/g),
  ].map((im) => ({ name: im[1] }));

  tables.push({ name, fields, indexes, searchIndexes });
}

if (tables.length === 0) throw new Error(`No se parseó ninguna tabla en ${schemaPath}`);

/* ── salida Mermaid ─────────────────────────────────────────────────────── */

const L = [];
L.push("erDiagram");
for (const t of tables) {
  L.push(`    ${t.name} {`);
  // Campos de sistema de Convex, explícitos para que el diagrama sea completo.
  L.push(`        Id _id PK`);
  L.push(`        number _creationTime`);
  for (const f of t.fields) {
    const notes = [];
    if (f.fk) notes.push("FK");
    if (f.optional) notes.push("nullable");
    L.push(`        ${f.type} ${f.key}${notes.length ? ` "${notes.join(", ")}"` : ""}`);
  }
  L.push(`    }`);
}
for (const t of tables) {
  for (const f of t.fields) {
    if (!f.fk) continue;
    // Padre: obligatorio (`||`) si el FK es requerido, opcional (`|o`) si no.
    // Hijo: siempre 0..N (un individuo puede no tener fichas todavía).
    const card = f.optional ? "|o--o{" : "||--o{";
    L.push(`    ${f.fk} ${card} ${t.name} : "${f.key}"`);
  }
}
console.log(L.join("\n"));

/* ── índices, como bloque comentado aparte (Mermaid no los modela) ──────── */
console.log("");
console.log("%% Índices (Mermaid erDiagram no los modela; generados del schema)");
for (const t of tables) {
  for (const ix of t.indexes) {
    console.log(`%%   ${t.name}.${ix.name} → [${ix.fields.join(", ")}]`);
  }
  for (const ix of t.searchIndexes) {
    console.log(`%%   ${t.name}.${ix.name} → searchIndex`);
  }
}
