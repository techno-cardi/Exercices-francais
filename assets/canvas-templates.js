/**
 * Gabarits communs pour les activités interactives.
 *
 * Le catalogue contient des mises en page différentes, mais elles sont toutes
 * traitées par les mêmes familles structurelles. Aucun identifiant d'activité
 * n'est utilisé ici : le gabarit est déduit uniquement des éléments présents.
 */
export function classifyCanvasTemplate(nodes, fields) {
  const labels = nodes.filter(node => node.classList.contains('canvas-label'));
  const hasTable = nodes.some(node => node.classList.contains('canvas-table'));
  const hasBreak = labels.some(label => label.querySelector('br'));
  const hasPlaceholder = labels.some(label => /[\s\u00a0]{2,}/u.test(label.textContent || ''));
  const hasChoice = nodes.some(node => /canvas-(dropdown_menu|association_droppable|checkbox)/u.test(node.className));
  const hasCheckbox = nodes.some(node => node.classList.contains('canvas-checkbox'));
  const hasFreeText = nodes.some(node => /canvas-(input|word_inputs)/u.test(node.className));
  const hasManyRows = labels.filter(label => {
    const height = Number(label.dataset.baseHeight) || label.getBoundingClientRect().height || 0;
    return height > 48;
  }).length > 0;

  if (hasTable) return { name: 'tableau', splitPlaceholders: false, alignTrailing: false, separateText: false };
  // Un bloc avec des retours de ligne garde sa structure : les espaces qu'il
  // contient servent souvent à l'alignement original, pas à des réponses.
  if (hasBreak) return { name: 'bloc-multiligne', splitPlaceholders: false, alignTrailing: false, separateText: true };
  if (hasCheckbox) return { name: 'choix-et-reperage', splitPlaceholders: false, alignTrailing: true, separateText: true };
  if (hasManyRows) return { name: 'bloc-multiligne', splitPlaceholders: false, alignTrailing: false, separateText: true };
  if (hasPlaceholder) return { name: 'texte-a-trous', splitPlaceholders: true, alignTrailing: true, separateText: true };
  if (hasChoice) return { name: 'choix-et-reperage', splitPlaceholders: false, alignTrailing: true, separateText: true };
  if (hasFreeText) return { name: 'reponse-courte', splitPlaceholders: false, alignTrailing: true, separateText: true };
  return { name: 'mise-en-page-libre', splitPlaceholders: false, alignTrailing: false, separateText: true };
}

export function applyCanvasTemplate(root, nodes, fields) {
  const template = classifyCanvasTemplate(nodes, fields);
  root.dataset.layoutTemplate = template.name;
  root.dataset.layoutTemplateReady = '1';
  return template;
}
