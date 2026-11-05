import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCsv, describeVariables, toNumber, typedRows, splitLine } from './csv.js';
import { validateChart, availableChartTypes } from './chartRules.js';
import { groupBy, histogram, reduce, densityGrid } from './aggregate.js';
import { parseJson, getPath, findArrayPaths } from './json.js';

describe('sources JSON / API', () => {
  const standings = JSON.parse(readFileSync(new URL('../../public/datasets/classement_ligue.json', import.meta.url), 'utf8'));

  it('suit un chemin et aplatit les objets imbriqués', () => {
    const p = parseJson(standings, 'standings.0.table');
    expect(p.rows.length).toBe(12);
    expect(p.columns).toContain('team.name');
    expect(p.columns).toContain('points');
    expect(p.issues).toEqual([]);
    const vars = describeVariables(p);
    expect(vars.find((v) => v.name === 'team.name').kind).toBe('categorical');
    expect(vars.find((v) => v.name === 'points').kind).toBe('numeric');
  });

  it('propose les chemins possibles si le chemin est faux', () => {
    const p = parseJson(standings, 'standings');
    expect(p.rows.length).toBe(1);
    const bad = parseJson(standings, 'competition');
    expect(bad.issues[0]).toContain('standings.0.table');
    expect(findArrayPaths(standings)).toContain('standings.0.table');
    expect(getPath({ a: [{ b: 2 }] }, 'a.0.b')).toBe(2);
  });
});

const sample = (name) => readFileSync(new URL(`../../public/datasets/${name}`, import.meta.url), 'utf8');

describe('parseCsv', () => {
  it('lit le format du sujet (séparateur ;)', () => {
    const p = parseCsv('a;b\n1;x\n2;y\n');
    expect(p.columns).toEqual(['a', 'b']);
    expect(p.rows).toEqual([{ a: '1', b: 'x' }, { a: '2', b: 'y' }]);
    expect(p.delimiter).toBe(';');
    expect(p.issues).toEqual([]);
  });

  it('nettoie les espaces des en-têtes (« Sex; Length; … »)', () => {
    const p = parseCsv(sample('abalone.csv'));
    expect(p.columns[0]).toBe('Sex');
    expect(p.columns[1]).toBe('Length');
    expect(p.rows.length).toBe(4177);
  });

  it("signale un en-tête qui ne correspond pas aux lignes (glass.csv : 11 noms, 10 valeurs)", () => {
    const p = parseCsv(sample('glass.csv'));
    expect(p.columns.length).toBe(11);
    expect(p.issues.some((i) => i.includes("n'ont pas 11 valeurs"))).toBe(true);
  });

  it('gère les guillemets et la virgule de secours', () => {
    expect(splitLine('"a;b";c', ';')).toEqual(['a;b', 'c']);
    const p = parseCsv('x,y\n1,2');
    expect(p.delimiter).toBe(',');
    expect(p.issues.length).toBe(1);
  });
});

describe('types des variables', () => {
  it('reconnaît catégorielles et numériques sur iris', () => {
    const p = parseCsv(sample('iris.csv'));
    const vars = describeVariables(p);
    expect(vars.find((v) => v.name === 'class').kind).toBe('categorical');
    expect(vars.find((v) => v.name === 'sepal length').kind).toBe('numeric');
  });

  it('accepte la virgule décimale française', () => {
    expect(toNumber('7,2')).toBe(7.2);
    expect(toNumber('10.4')).toBe(10.4);
    expect(Number.isNaN(toNumber('S1'))).toBe(true);
  });

  it('convertit les valeurs selon le type choisi', () => {
    const p = parseCsv('s;v\nS1;7,2\nS2;8');
    const rows = typedRows(p, [{ name: 's', kind: 'categorical' }, { name: 'v', kind: 'numeric' }]);
    expect(rows[0]).toEqual({ s: 'S1', v: 7.2 });
  });
});

describe('règles des visualisations', () => {
  const vars = [
    { name: 'class', kind: 'categorical' },
    { name: 'length', kind: 'numeric' },
    { name: 'width', kind: 'numeric' },
  ];

  it('refuse un camembert avec une légende numérique', () => {
    const errors = validateChart({ datasetId: 'd', chartType: 'pie', x: 'length', y: 'width' }, vars);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('numérique');
  });

  it('accepte un nuage de points sur deux numériques', () => {
    expect(validateChart({ datasetId: 'd', chartType: 'scatter', x: 'length', y: 'width' }, vars)).toEqual([]);
  });

  it('refuse un nuage de points sur une catégorielle', () => {
    expect(validateChart({ datasetId: 'd', chartType: 'scatter', x: 'class', y: 'width' }, vars).length).toBe(1);
  });

  it("ne propose pas de barres sans variable catégorielle", () => {
    expect(availableChartTypes([{ name: 'a', kind: 'numeric' }])).not.toContain('bar');
  });
});

describe('agrégations', () => {
  const rows = [
    { c: 'A', v: 2 },
    { c: 'B', v: 4 },
    { c: 'A', v: 6 },
  ];
  it('groupe et agrège', () => {
    expect(groupBy(rows, 'c', 'v', 'mean')).toEqual([{ label: 'A', value: 4 }, { label: 'B', value: 4 }]);
    expect(groupBy(rows, 'c')).toEqual([{ label: 'A', value: 2 }, { label: 'B', value: 1 }]);
  });
  it('calcule un histogramme', () => {
    const h = histogram(rows, 'v', 2);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
  it('dernière valeur, médiane, écart-type', () => {
    expect(reduce([1, 2, 3], 'last')).toBe(3);
    expect(reduce([1, 9, 3], 'median')).toBe(3);
    expect(reduce([2, 4, 4, 4, 5, 5, 7, 9], 'std')).toBeCloseTo(2.138, 3);
  });
  it('heatmap : répartit les positions sur la grille', () => {
    const { grid, total, max } = densityGrid([{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 99, y: 99 }], 'x', 'y', null, 12, 8);
    expect(total).toBe(3);
    expect(grid[0][0]).toBe(2);
    expect(grid[7][11]).toBe(1);
    expect(max).toBe(2);
  });
  it('règles : heatmap et face-à-face', () => {
    const v = [{ name: 'Joueur', kind: 'categorical' }, { name: 'x', kind: 'numeric' }, { name: 'y', kind: 'numeric' }];
    expect(validateChart({ datasetId: 'd', chartType: 'heatmap', x: 'x', y: 'y' }, v)).toEqual([]);
    expect(validateChart({ datasetId: 'd', chartType: 'versus', x: 'Joueur', series: ['x', 'y'] }, v)).toEqual([]);
    expect(validateChart({ datasetId: 'd', chartType: 'versus', x: 'x', series: ['Joueur'] }, v).length).toBe(2);
  });
});
