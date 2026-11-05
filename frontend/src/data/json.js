// Sources JSON et API open data (football-data.org, TheSportsDB, Jolpica-F1…).
// On stocke le lien, le chemin vers le tableau dans la réponse et le type des variables ;
// les objets imbriqués sont aplatis en colonnes « team.name », « team.crest »…

export function getPath(data, path) {
  if (!path) return data;
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc === undefined || acc === null ? undefined : acc[/^\d+$/.test(key) ? Number(key) : key]), data);
}

function flatten(obj, prefix = '', out = {}, depth = 0) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 3) flatten(v, key, out, depth + 1);
    else if (Array.isArray(v)) out[key] = v.length;
    else out[key] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

// Cherche automatiquement le premier tableau d'objets dans la réponse (pour proposer un chemin).
export function findArrayPaths(data, prefix = '', found = [], depth = 0) {
  if (Array.isArray(data)) {
    if (data.length && typeof data[0] === 'object' && data[0] !== null) found.push(prefix);
    if (depth < 4 && data.length && typeof data[0] === 'object') findArrayPaths(data[0], prefix ? `${prefix}.0` : '0', found, depth + 1);
    return found;
  }
  if (data && typeof data === 'object' && depth < 4) {
    for (const [k, v] of Object.entries(data)) findArrayPaths(v, prefix ? `${prefix}.${k}` : k, found, depth + 1);
  }
  return found;
}

// Même format de sortie que parseCsv : { columns, rows, issues }.
export function parseJson(data, path) {
  const issues = [];
  let target = getPath(data, path);
  if (!Array.isArray(target)) {
    const candidates = findArrayPaths(data);
    issues.push(
      candidates.length
        ? `Le chemin « ${path || '(racine)'} » ne mène pas à un tableau. Chemins possibles : ${candidates.slice(0, 5).map((c) => c || '(racine)').join(', ')}.`
        : 'Aucun tableau d’objets trouvé dans la réponse.',
    );
    target = [];
  }
  const rows = target.filter((r) => r && typeof r === 'object').map((r) => flatten(r));
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  rows.forEach((r) => columns.forEach((c) => (r[c] = r[c] ?? '')));
  return { columns, rows, delimiter: null, issues };
}
