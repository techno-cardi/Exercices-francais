import fs from 'node:fs';
import path from 'node:path';

const sourcePath = process.argv[2] || 'C:/Users/kevin/Downloads/exercices-source.json';
const root = path.resolve(import.meta.dirname, '..');
const publicDataDir = path.join(root, 'data');
const matricesDir = path.join(publicDataDir, 'matrices');
const privateDir = path.join(root, 'private');

const phraseReplacements = new Map([
  ['Je cherchais mon chemin', 'Je suivais une piste'],
  ['cherchait son chemin', 'suivait une piste'],
  ['m’arrêtai pour souffler', 'fis une pause pour reprendre mon souffle'],
  ["m'arrêtai pour souffler", 'fis une pause pour reprendre mon souffle'],
  ['s’arrêta pour souffler', 'fit une pause pour reprendre son souffle'],
  ["s'arrêta pour souffler", 'fit une pause pour reprendre son souffle'],
  ['de lourds pas résonnèrent derrière moi', 'des branches craquèrent derrière moi'],
  ['de lourds pas résonnèrent derrière elle', 'des branches craquèrent derrière elle'],
  ['s’élancer à sa poursuite', 'se lancer sur ses traces'],
  ["s'élancer à sa poursuite", 'se lancer sur ses traces'],
  ['change d’emploi aussi souvent', 'change de métier aussi souvent'],
  ["change d'emploi aussi souvent", 'change de métier aussi souvent'],
  ['écoute des documentaires', 'suit des balados éducatifs'],
  ['passait tout près de son œil gauche', 'longeait son sourcil gauche'],
  ['peau de porcelaine', 'teint couleur de neige'],
]);

const replacements = new Map([
  ['Hélène', 'Nora'],
  ['Adamo', 'Malik'],
  ['Manuel', 'Émile'],
  ['Marie', 'Naïma'],
  ['Julien', 'Félix'],
  ['Sophie', 'Inès'],
  ['Thomas', 'Loïc'],
  ['Alexandre', 'Milo'],
  ['Alex', 'Sam'],
  ['Émilie', 'Maëlle'],
  ['Émile', 'Loïc'],
  ['Sarah', 'Lina'],
  ['Samuel', 'Noé'],
  ['Antoine', 'Yanis'],
  ['Camille', 'Océane'],
  ['Gabriel', 'Idris'],
  ['Mathieu', 'Théo'],
  ['Maxime', 'Éli'],
  ['Chloé', 'Aya'],
  ['Charles', 'Léon'],
  ['Florence', 'Maya'],
  ['Neve', 'Yuna'],
  ['forêt', 'vallée'],
  ['gardes', 'cavaliers'],
  ['pizza', 'tarte'],
  ['élèves', 'campeurs'],
  ['livre', 'carnet'],
  ['fenêtre', 'vitrine'],
  ['piano', 'violon'],
  ['corridors', 'escaliers'],
  ['match', 'tournoi'],
  ['équipe', 'escouade'],
  ['pomme', 'poire'],
  ['chat', 'renard'],
  ['souris', 'gazelle'],
  ['soupe', 'salade'],
  ['maison', 'cabane'],
  ['chien', 'lama'],
  ['croquettes', 'fougères'],
  ['école', 'bibliothèque'],
  ['village', 'quartier'],
  ['rivière', 'lagune'],
  ['montagne', 'colline'],
  ['vélo', 'kayak'],
  ['voiture', 'caravane'],
  ['bus', 'métro'],
  ['cinéma', 'musée'],
  ['restaurant', 'refuge'],
  ['parc', 'jardin'],
  ['ballon', 'cerf-volant'],
  ['gâteau', 'flan'],
  ['fleurs', 'tulipes'],
  ['plage', 'clairière'],
  ['bureau', 'atelier'],
  ['ordinateur', 'projecteur'],
  ['professeur', 'guide'],
  ['enseignante', 'animatrice'],
  ['frère', 'cousin'],
  ['sœur', 'cousine'],
  ['soeur', 'cousine'],
  ['mère', 'tante'],
  ['père', 'oncle'],
  ['amie', 'voisine'],
  ['amis', 'voisins'],
  ['ami', 'voisin'],
]);

const replacementKeys = [...replacements.keys()].sort((a, b) => b.length - a.length);
const replacementExpression = new RegExp(
  `(^|[^\\p{L}\\p{N}_])(${replacementKeys.map(escapeRegex).join('|')})(?=$|[^\\p{L}\\p{N}_])`,
  'giu',
);

let rewrittenStrings = 0;
const rewrittenTerms = new Map();

function replaceOriginalDetails(value) {
  if (typeof value !== 'string' || !value) return value;
  let next = value;

  for (const [before, after] of phraseReplacements) {
    if (!next.includes(before)) continue;
    const count = next.split(before).length - 1;
    next = next.split(before).join(after);
    rewrittenTerms.set(`${before} → ${after}`, (rewrittenTerms.get(`${before} → ${after}`) || 0) + count);
  }

  next = next.replace(replacementExpression, (match, prefix, term) => {
    const key = replacementKeys.find(candidate => candidate.toLocaleLowerCase('fr') === term.toLocaleLowerCase('fr'));
    if (!key) return match;
    let replacement = replacements.get(key);
    if (term[0] === term[0].toLocaleUpperCase('fr')) {
      replacement = replacement[0].toLocaleUpperCase('fr') + replacement.slice(1);
    }
    rewrittenTerms.set(`${key} → ${replacements.get(key)}`, (rewrittenTerms.get(`${key} → ${replacements.get(key)}`) || 0) + 1);
    return prefix + replacement;
  });

  if (next !== value) rewrittenStrings += 1;
  return next;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteDeep(value) {
  if (typeof value === 'string') return replaceOriginalDetails(value);
  if (Array.isArray(value)) return value.map(rewriteDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteDeep(item)]));
}

function cloneWithoutPrivateFields(value) {
  if (Array.isArray(value)) return value.map(cloneWithoutPrivateFields);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'response') continue;
    if (key === 'preview_html') continue;
    if (key === 'word' && typeof item === 'boolean') continue;
    output[key] = cloneWithoutPrivateFields(item);
  }
  return output;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function normalizeExpected(value) {
  if (Array.isArray(value)) return value.map(normalizeExpected);
  if (typeof value === 'string') return replaceOriginalDetails(value).normalize('NFC');
  return value;
}

function answerDefinitions(elements) {
  const answers = [];
  const draggables = elements.filter(element => element.type === 'association_draggable');
  const linkables = elements.filter(element => element.type === 'linkable');

  const draggableIdsByCode = new Map();
  for (const element of draggables) {
    const code = element.response?.value;
    if (code == null) continue;
    const ids = draggableIdsByCode.get(String(code)) || [];
    ids.push(element.id);
    draggableIdsByCode.set(String(code), ids);
  }

  const linkableDestinationsByCode = new Map();
  for (const element of linkables.filter(item => item.linkable_type === 'destination')) {
    const code = element.response?.value;
    if (code == null) continue;
    const ids = linkableDestinationsByCode.get(String(code)) || [];
    ids.push(element.id);
    linkableDestinationsByCode.set(String(code), ids);
  }

  for (const element of elements) {
    const response = element.response;
    switch (element.type) {
      case 'dropdown_menu':
      case 'input':
        answers.push({
          id: element.id,
          type: element.type,
          expected: asArray(response?.values).map(normalizeExpected),
          caseSensitive: Boolean(response?.case_sensitive),
        });
        break;
      case 'word_inputs':
        answers.push({
          id: element.id,
          type: element.type,
          expected: asArray(response?.values).map(normalizeExpected),
          caseSensitive: Boolean(response?.case_sensitive),
        });
        break;
      case 'checkbox':
        answers.push({ id: element.id, type: element.type, expected: Boolean(response?.value) });
        break;
      case 'sorted_items':
        answers.push({ id: element.id, type: element.type, expected: normalizeExpected(response?.value || []) });
        break;
      case 'association_droppable': {
        const acceptedIds = draggableIdsByCode.get(String(response?.value)) || [];
        answers.push({ id: element.id, type: element.type, expected: acceptedIds });
        break;
      }
      case 'linkable':
        if (element.linkable_type === 'source') {
          answers.push({
            id: element.id,
            type: element.type,
            expected: linkableDestinationsByCode.get(String(response?.value)) || [],
          });
        }
        break;
      case 'words_highlight': {
        const selected = asArray(element.words_list).some(word => word?.word === true);
        const responseValues = asArray(response?.values).filter(Boolean).map(normalizeExpected);
        answers.push({
          id: element.id,
          type: element.type,
          expected: responseValues.length ? responseValues : selected,
        });
        break;
      }
      default:
        break;
    }
  }

  return answers;
}

function publicElements(elements) {
  const clean = elements.map(cloneWithoutPrivateFields);
  const draggables = clean
    .filter(element => element.type === 'association_draggable')
    .map(element => ({ id: element.id, text: element.text || 'Élément' }));
  const linkableDestinations = clean
    .filter(element => element.type === 'linkable' && element.linkable_type === 'destination')
    .map(element => ({ id: element.id, text: element.text || 'Élément' }));

  return clean.map(element => {
    if (element.type === 'association_droppable') {
      return { ...element, choices: draggables };
    }
    if (element.type === 'linkable' && element.linkable_type === 'source') {
      return { ...element, choices: linkableDestinations };
    }
    return element;
  });
}

function exerciseTypes(elements) {
  const labels = {
    dropdown_menu: 'Menus',
    input: 'Réponses écrites',
    word_inputs: 'Mots à compléter',
    checkbox: 'Cases à cocher',
    sorted_items: 'Classement',
    association_droppable: 'Associations',
    linkable: 'Liens',
    words_highlight: 'Repérage',
  };
  return [...new Set(elements.map(element => labels[element.type]).filter(Boolean))];
}

function compactTheory(document) {
  const theory = document?.theory;
  const explanations = document?.explanations;
  return {
    theory: theory?.text || '',
    explanation: explanations?.text || '',
  };
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (source.version !== 'v4-structure-integrale') {
  throw new Error(`Export v4 attendu; version reçue: ${source.version || 'inconnue'}`);
}
if (Number(source.summary?.exercises) !== 1030 || Number(source.summary?.failures) !== 0) {
  throw new Error('L’export ne contient pas les 1 030 exercices complets attendus.');
}

fs.mkdirSync(matricesDir, { recursive: true });
fs.mkdirSync(privateDir, { recursive: true });

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  title: 'Atelier de français',
  level: 'Secondaire 3',
  sourceSummary: {
    matrices: source.summary.matrices,
    exercises: source.summary.exercises,
  },
  matrices: [],
};
const answerBank = {
  version: 1,
  generatedAt: new Date().toISOString(),
  exercises: {},
};
const typeCounts = new Map();
let answerCount = 0;

for (const collection of source.collections || []) {
  for (const component of collection.components || []) {
    for (const matrixEntry of component.matrices || []) {
      const rewrittenMatrix = rewriteDeep(matrixEntry.matrix);
      const matrixId = String(matrixEntry.matrix_id);
      const exercises = [];
      const matrixTypes = new Set();

      for (const rawExercise of rewrittenMatrix.exercises || []) {
        const exerciseId = String(rawExercise.id);
        const exerciseDocument = rawExercise.document || {};
        const canvas = exerciseDocument.exercice?.canvas || {};
        const elements = Array.isArray(canvas.elements) ? canvas.elements : [];
        const answers = answerDefinitions(elements);
        const types = exerciseTypes(elements);
        types.forEach(type => matrixTypes.add(type));

        for (const answer of answers) {
          typeCounts.set(answer.type, (typeCounts.get(answer.type) || 0) + 1);
        }
        answerCount += answers.length;

        exercises.push({
          id: exerciseId,
          name: rawExercise.name || `Exercice ${exerciseId}`,
          title: exerciseDocument.exercice?.title?.text || 'Exercice de français',
          canvas: {
            width: Number(canvas.width) || 650,
            height: Number(canvas.height) || 400,
            elements: publicElements(elements),
          },
          types,
          ...compactTheory(exerciseDocument),
        });

        answerBank.exercises[exerciseId] = {
          matrixId,
          answers,
        };
      }

      const hierarchy = replaceOriginalDetails(matrixEntry.hierarchy_path || matrixEntry.label || 'Français');
      const label = replaceOriginalDetails(matrixEntry.label || hierarchy.split(' > ').at(-1));
      const matrixPublic = {
        id: matrixId,
        label,
        hierarchy,
        types: [...matrixTypes],
        exerciseCount: exercises.length,
        exercises,
      };
      fs.writeFileSync(path.join(matricesDir, `${matrixId}.json`), `${JSON.stringify(matrixPublic)}\n`, 'utf8');
      catalog.matrices.push({
        id: matrixId,
        label,
        hierarchy,
        path: hierarchy.split(' > ').map(part => part.trim()).filter(Boolean),
        types: [...matrixTypes],
        exerciseCount: exercises.length,
        exerciseIds: exercises.map(exercise => exercise.id),
      });
    }
  }
}

catalog.matrices.sort((a, b) => a.hierarchy.localeCompare(b.hierarchy, 'fr'));
fs.writeFileSync(path.join(publicDataDir, 'catalog.json'), `${JSON.stringify(catalog)}\n`, 'utf8');
fs.writeFileSync(path.join(privateDir, 'answer-bank.json'), `${JSON.stringify(answerBank)}\n`, 'utf8');

const report = {
  matrices: catalog.matrices.length,
  exercises: Object.keys(answerBank.exercises).length,
  answerFields: answerCount,
  publicBytes: fs.statSync(path.join(publicDataDir, 'catalog.json')).size + catalog.matrices.reduce(
    (sum, matrix) => sum + fs.statSync(path.join(matricesDir, `${matrix.id}.json`)).size,
    0,
  ),
  privateBytes: fs.statSync(path.join(privateDir, 'answer-bank.json')).size,
  rewrittenStrings,
  rewrittenTerms: Object.fromEntries([...rewrittenTerms.entries()].sort()),
  answerTypes: Object.fromEntries([...typeCounts.entries()].sort()),
};
fs.writeFileSync(path.join(privateDir, 'import-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(report, null, 2));
