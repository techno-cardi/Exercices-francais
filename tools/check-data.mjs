import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalog = read('data/catalog.json');
const answerBank = read('private/answer-bank.json');
const errors = [];
let exerciseCount = 0;
const publicWidgets = new Map();

if (catalog.matrices.length !== 103) errors.push(`Nombre de notions inattendu : ${catalog.matrices.length}`);
for (const entry of catalog.matrices) {
  const matrix = read(`data/matrices/${entry.id}.json`);
  if (containsKey(matrix, 'response')) errors.push(`Réponse publique détectée dans ${entry.id}.json`);
  for (const exercise of matrix.exercises) {
    exerciseCount += 1;
    publicWidgets.set(String(exercise.id), new Set((exercise.canvas?.elements || []).map(element => String(element.id))));
  }
}
if (exerciseCount !== 1030) errors.push(`Nombre d’exercices inattendu : ${exerciseCount}`);
if (Object.keys(answerBank.exercises).length !== exerciseCount) errors.push('Le corrigé privé ne correspond pas à la banque publique.');
for (const [exerciseId, exercise] of Object.entries(answerBank.exercises)) {
  const widgets = publicWidgets.get(exerciseId);
  if (!widgets) { errors.push(`Exercice privé absent du site : ${exerciseId}`); continue; }
  for (const answer of exercise.answers) if (!widgets.has(String(answer.id))) errors.push(`Élément ${answer.id} absent de l’exercice ${exerciseId}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Vérification réussie : ${catalog.matrices.length} notions et ${exerciseCount} exercices, corrigés séparés.`);

function read(relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
function containsKey(value, key) { if (!value || typeof value !== 'object') return false; if (Object.prototype.hasOwnProperty.call(value, key)) return true; return Object.values(value).some(child => containsKey(child, key)); }
