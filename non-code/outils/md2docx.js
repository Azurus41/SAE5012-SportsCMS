// Convertit les comptes rendus Markdown en .docx (sous-ensemble Markdown utilisé dans les livrables).
// Usage : node md2docx.js <sortie.docx> "<titre>" <fichier1.md> [fichier2.md ...]
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, AlignmentType, PageBreak, Footer, PageNumber, ImageRun,
} = require('docx');
const path = require('path');
let figure = 0;
let listInstance = 0;

function image(alt, file) {
  figure++;
  const caption = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: `Figure ${figure} — ${alt}`, italics: true, size: 18, color: '595959' })] });
  if (!fs.existsSync(file)) {
    return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 },
      border: { top: { style: BorderStyle.DASHED, size: 6, color: 'C00000', space: 6 }, bottom: { style: BorderStyle.DASHED, size: 6, color: 'C00000', space: 6 } },
      children: [new TextRun({ text: `[Capture à insérer ici : ${path.basename(file)}]`, bold: true, color: 'C00000' })] }), caption];
  }
  const buf = fs.readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);   // en-tête PNG (IHDR)
  const maxW = 600, maxH = 560;
  const k = Math.min(1, maxW / w, maxH / h);
  return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
    children: [new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(w * k), height: Math.round(h * k) },
      altText: { title: alt, description: alt, name: path.basename(file) } })] }), caption];
}

const [out, title, ...inputs] = process.argv.slice(2);
const PAGE_W = 9638; // A4, marges 2 cm
const MONO = 'Consolas';
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function inline(text, base = {}) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) {
      runs.push(...inline(t.slice(2, -2), { ...base, bold: true }));
    }
    else if (t.startsWith('`')) runs.push(new TextRun({ text: t.slice(1, -1), font: MONO, size: 19, color: '7A2E0E', ...base }));
    else runs.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...base }));
  return runs;
}

function codeBlock(lines) {
  return lines.map((l, i) => new Paragraph({
    children: [new TextRun({ text: l.length ? l : ' ', font: MONO, size: 17 })],
    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' },
    spacing: { before: i === 0 ? 60 : 0, after: i === lines.length - 1 ? 120 : 0, line: 240 },
    indent: { left: 113, right: 113 },
  }));
}

function table(rows) {
  const cells = rows.map(r => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|')));
  const header = cells[0];
  const body = cells.slice(2);
  const n = header.length;
  const weight = Array.from({ length: n }, (_, j) => Math.max(6, ...cells.filter((_, i) => i !== 1).map(r => Math.min((r[j] || '').length, 70))));
  const sum = weight.reduce((a, b) => a + b, 0);
  const widths = weight.map(w => Math.floor((w / sum) * PAGE_W));
  widths[n - 1] += PAGE_W - widths.reduce((a, b) => a + b, 0);
  const mk = (row, isHead) => new TableRow({
    tableHeader: isHead,
    children: widths.map((w, j) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders,
      shading: isHead ? { type: ShadingType.CLEAR, fill: 'DCE6F2', color: 'auto' } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ children: inline(row[j] || '', { size: 18, bold: isHead || undefined }), spacing: { after: 0 } })],
    })),
  });
  return [new Table({ width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: widths, rows: [mk(header, true), ...body.map(r => mk(r, false))] }),
    new Paragraph({ children: [], spacing: { after: 60 } })];
}

function convert(md, dir) {
  const out = [];
  const lines = md.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const img = l.match(/^!\[(.*)\]\((.*)\)\s*$/);
    if (img) {
      out.push(...image(img[1], path.join(dir, img[2])));
    } else if (l.trim().startsWith('```')) {
      const indent = l.match(/^\s*/)[0].length;
      const buf = [];
      while (++i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i].slice(Math.min(indent, lines[i].match(/^\s*/)[0].length)));
      out.push(...codeBlock(buf));
    } else if (l.startsWith('|')) {
      const buf = [l];
      while (i + 1 < lines.length && lines[i + 1].startsWith('|')) buf.push(lines[++i]);
      out.push(...table(buf));
    } else if (/^#{1,3} /.test(l)) {
      const lvl = l.match(/^#+/)[0].length;
      out.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][lvl - 1], children: inline(l.slice(lvl + 1)) }));
    } else if (/^\s*- /.test(l)) {
      const lvl = l.match(/^\s*/)[0].length >= 2 ? 1 : 0;
      out.push(new Paragraph({ numbering: { reference: 'puces', level: lvl }, children: inline(l.replace(/^\s*- /, '')) }));
    } else if (/^\d+\. /.test(l)) {
      if (/^1\. /.test(l)) listInstance++;   // une liste qui commence à « 1. » repart de 1
      out.push(new Paragraph({ numbering: { reference: 'numeros', level: 0, instance: listInstance }, children: inline(l.replace(/^\d+\. /, '')) }));
    } else if (/^\s{2,}\S/.test(l) && i > 0 && /^\d+\. /.test(lines[i - 1].trim() ? lines[i - 1] : '')) {
      out.push(new Paragraph({ indent: { left: 720 }, children: inline(l.trim()) }));
    } else if (l.startsWith('> ')) {
      out.push(new Paragraph({ children: inline(l.slice(2), { italics: true }), indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: '8EAADB', space: 8 } } }));
    } else if (l.trim() === '---') {
      out.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 1 } } }));
    } else if (l.trim()) {
      // fusionne les lignes d'un même paragraphe (retour à la ligne Markdown « deux espaces » → saut de ligne)
      const parts = [l];
      while (i + 1 < lines.length && lines[i + 1].trim() && !/^\s*(```|\||#|- |\d+\. |> |---|!\[)/.test(lines[i + 1])) parts.push(lines[++i]);
      const children = [];
      parts.forEach((p, k) => { if (k) children.push(new TextRun({ break: 1 })); children.push(...inline(p.trimEnd())); });
      out.push(new Paragraph({ children }));
    }
  }
  return out;
}

const header = [
  new Paragraph({ children: [new TextRun({ text: 'NOMS : ', bold: true }), new TextRun('BOURDIN POMBO — GUILLON')] }),
  new Paragraph({ children: [new TextRun({ text: 'Prénoms : ', bold: true }), new TextRun('Azur — Ewen')] }),
  new Paragraph({ children: [new TextRun({ text: 'Groupe : ', bold: true })] }),
  new Paragraph({ children: [new TextRun({ text: 'Date : ', bold: true }), new TextRun('14/10/2026')], spacing: { after: 360 } }),
  new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun(title)] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
    children: [new TextRun({ text: 'BUT MMI Blois — SAÉ 501.2 — R508 Déploiement de services (J. Lasserre)', italics: true, color: '595959' })] }),
];
const body = [];
inputs.forEach((f, k) => {
  if (k) body.push(new Paragraph({ children: [new PageBreak()] }));
  body.push(...convert(fs.readFileSync(f, 'utf8'), path.dirname(f)));
});

const doc = new Document({
  creator: 'SAE5012', title,
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 }, paragraph: { spacing: { after: 100, line: 264 } } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 40, bold: true, color: '1F3864' }, paragraph: { spacing: { after: 120 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: '2E74B5' }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: '2E74B5' }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'puces', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } }] },
    { reference: 'numeros', levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: title + ' — page ', size: 16, color: '808080' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '808080' })] })] }) },
    children: [...header, ...body],
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(out, b); console.log('écrit :', out); });
