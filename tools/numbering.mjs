import fs from 'node:fs';
import path from 'node:path';

const textThemeOrder = new Map([
  ['Le texte narratif', 10],
  ['Le texte explicatif', 11],
  ['Le texte poétique', 12],
]);

export function applyNumbering(catalog, matricesDir) {
  const themes = new Map();
  for (const matrix of catalog.matrices) {
    const themeLabel = matrix.path?.[1] || matrix.path?.[0] || 'Français';
    const parsed = Number.parseInt(String(themeLabel).match(/^\s*(\d+)/)?.[1] || '', 10);
    const themeNumber = Number.isFinite(parsed) ? parsed : (textThemeOrder.get(themeLabel) || 99);
    const themeName = String(themeLabel).replace(/^\s*\d+\s*[-–—]\s*/, '').trim();
    const key = `${themeNumber}|${themeName}`;
    if (!themes.has(key)) themes.set(key, { number:themeNumber, label:themeName, root:matrix.path?.[0] || 'Français', matrices:[] });
    themes.get(key).matrices.push(matrix);
  }

  const orderedThemes = [...themes.values()].sort((a,b)=>a.number-b.number || a.label.localeCompare(b.label,'fr'));
  for (const theme of orderedThemes) {
    theme.matrices.sort((a,b)=>notionPriority(a)-notionPriority(b) || Number(a.id)-Number(b.id) || a.label.localeCompare(b.label,'fr'));
    theme.matrices.forEach((matrix,index)=>{
      matrix.themeNumber=String(theme.number);
      matrix.themeLabel=theme.label;
      matrix.number=`${theme.number}.${index+1}`;
      matrix.displayLabel=`${matrix.number} — ${matrix.label}`;
      const filePath=path.join(matricesDir,`${matrix.id}.json`);
      const detail=JSON.parse(fs.readFileSync(filePath,'utf8'));
      detail.themeNumber=matrix.themeNumber;
      detail.themeLabel=matrix.themeLabel;
      detail.number=matrix.number;
      detail.displayLabel=matrix.displayLabel;
      detail.exercises=(detail.exercises||[]).map((exercise,exerciseIndex)=>({
        ...exercise,
        number:`${matrix.number}.${exerciseIndex+1}`,
        displayLabel:`${matrix.number}.${exerciseIndex+1} — ${matrix.label}`,
      }));
      fs.writeFileSync(filePath,`${JSON.stringify(detail)}\n`,'utf8');
    });
  }

  catalog.themes=orderedThemes.map(theme=>({number:String(theme.number),label:theme.label,root:theme.root}));
  catalog.matrices=orderedThemes.flatMap(theme=>theme.matrices);
  return catalog;
}

function notionPriority(matrix) {
  const label=String(matrix.label||'').toLocaleLowerCase('fr');
  if (label.startsWith('révision')) return 80;
  if (label.startsWith('évaluation')) return 90;
  if (label.startsWith('test')) return 100;
  return 0;
}
