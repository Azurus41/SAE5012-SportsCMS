// Lecture des jeux de données CSV décrits dans le sujet :
//   Nom Variable 1;...;Nom Variable N
//   Valeur Ind 1 Variable 1;...;Valeur Ind 1 Variable N
// Le séparateur attendu est « ; ». La virgule et la tabulation sont acceptées en secours.

const DELIMITERS = [';', ',', '\t'];

export function detectDelimiter(headerLine) {
  let best = ';';
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

// Découpe une ligne en tenant compte des champs entre guillemets ("a;b" reste un seul champ).
export function splitLine(line, delimiter) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (c === delimiter) {
      out.push(field.trim());
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field.trim());
  return out;
}

// « 7,2 » (virgule décimale française) et « 7.2 » sont tous deux des nombres.
export function toNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim().replace(/\s/g, '');
  if (s === '') return NaN;
  const normalized = /^-?\d+,\d+$/.test(s) ? s.replace(',', '.') : s;
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

// Une variable est proposée « numérique » si au moins 95 % de ses valeurs non vides sont des nombres
// et qu'elle n'a pas l'allure d'un code (peu de valeurs distinctes entières, ex. « Type of glass »).
export function inferKind(values) {
  const filled = values.filter((v) => v !== '' && v !== null && v !== undefined);
  if (filled.length === 0) return 'categorical';
  const numeric = filled.filter((v) => !Number.isNaN(toNumber(v)));
  if (numeric.length / filled.length < 0.95) return 'categorical';
  const distinct = new Set(numeric.map((v) => toNumber(v)));
  const allIntegers = [...distinct].every((n) => Number.isInteger(n));
  if (allIntegers && distinct.size <= 8 && filled.length >= 30) return 'categorical';
  return 'numeric';
}

// Renvoie { columns, rows, delimiter, issues } ; rows est une liste d'objets { colonne: valeur brute }.
export function parseCsv(text, { delimiter } = {}) {
  const lines = String(text)
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    return { columns: [], rows: [], delimiter: delimiter || ';', issues: ['Le fichier est vide.'] };
  }
  const sep = delimiter || detectDelimiter(lines[0]);
  const columns = uniqueNames(splitLine(lines[0], sep).map((c, i) => c || `Variable ${i + 1}`));
  const rows = [];
  const issues = [];
  let mismatches = 0;
  let firstMismatch = null;
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], sep);
    if (cells.length !== columns.length) {
      mismatches++;
      if (firstMismatch === null) firstMismatch = { line: i + 1, found: cells.length };
    }
    const row = {};
    columns.forEach((col, j) => {
      row[col] = cells[j] ?? '';
    });
    rows.push(row);
  }
  if (sep !== ';') {
    issues.push(`Séparateur « ${sep === '\t' ? 'tabulation' : sep} » détecté au lieu de « ; ».`);
  }
  if (mismatches > 0) {
    issues.push(
      `${mismatches} ligne(s) n'ont pas ${columns.length} valeurs (première : ligne ${firstMismatch.line}, ` +
        `${firstMismatch.found} valeurs). Vérifiez l'en-tête : une variable est peut-être en trop ou manquante.`,
    );
  }
  return { columns, rows, delimiter: sep, issues };
}

function uniqueNames(names) {
  const seen = new Map();
  return names.map((n) => {
    const count = seen.get(n) || 0;
    seen.set(n, count + 1);
    return count === 0 ? n : `${n} (${count + 1})`;
  });
}

export function describeVariables(parsed) {
  return parsed.columns.map((name) => {
    const values = parsed.rows.map((r) => r[name]);
    const kind = inferKind(values);
    const distinct = new Set(values.filter((v) => v !== '')).size;
    const invalid = values.filter((v) => v !== '' && Number.isNaN(toNumber(v))).length;
    return { name, kind, distinct, invalidNumbers: invalid };
  });
}

// Convertit les lignes selon le type choisi pour chaque variable par le fournisseur de données.
export function typedRows(parsed, variables) {
  const kinds = Object.fromEntries(variables.map((v) => [v.name, v.kind]));
  return parsed.rows.map((r) => {
    const out = {};
    for (const col of parsed.columns) {
      out[col] = kinds[col] === 'numeric' ? toNumber(r[col]) : r[col];
    }
    return out;
  });
}
