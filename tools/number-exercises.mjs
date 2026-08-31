import fs from 'node:fs';
import path from 'node:path';
import { applyNumbering } from './numbering.mjs';

const root=path.resolve(import.meta.dirname,'..');
const catalogPath=path.join(root,'data','catalog.json');
const matricesDir=path.join(root,'data','matrices');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
applyNumbering(catalog,matricesDir);
fs.writeFileSync(catalogPath,`${JSON.stringify(catalog)}\n`,'utf8');
console.log(`Numérotation terminée : ${catalog.themes.length} thèmes, ${catalog.matrices.length} notions.`);
