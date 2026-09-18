'use strict';

const CFB_SCHEMA = 'cardinal.formative/1';
const CFB_ENDPOINT = 'https://svc.goformative.com/graphql';

const CFB_DOCS = {
  permission: `query FormativePermissionCheck($formativeId: ID!) {
    formative(id: $formativeId) {
      _id
      viewerPermissions
      __typename
    }
  }`,
  layout: `query FormativeLayout($formativeId: ID!) {
    formative(id: $formativeId) {
      _id
      title
      viewerPermissions
      items {
        _id
        parentId
        subtype
        text
        details {
          points
          __typename
        }
        __typename
      }
      __typename
    }
  }`,
  create: `mutation FormativeTeacherAddFormativeItem(
    $formativeId: ID!,
    $subtype: FormativeItemSubType!,
    $parentId: ID,
    $input: FormativeItemInput!
  ) {
    payload: addFormativeItem(
      formativeId: $formativeId
      subtype: $subtype
      parentId: $parentId
      input: $input
    ) {
      formativeItem {
        _id
        __typename
      }
      __typename
    }
  }`,
  updateQuestion: `mutation QuestionEditableUpdateFormativeItem(
    $formativeItemId: ID!,
    $input: FormativeItemInput!,
    $withHasItemTags: Boolean!
  ) {
    updateFormativeItem(id: $formativeItemId, input: $input) {
      formativeItem {
        _id
        subtype
        text
        details {
          points
          correctAnswers
          answerChoicePoints
          isKeywordGrading
          isPartialCredit
          isCaseSensitive
          __typename
        }
        __typename
      }
      __typename
    }
  }`,
  updateText: `mutation TextEditableUpdate($formativeItemId: ID!, $text: String!) {
    updateFormativeItem(id: $formativeItemId, input: {text: $text}) {
      formativeItem {
        _id
        html
        text
        __typename
      }
      __typename
    }
  }`
};

const CFB_OPS = {
  permission: ['query/FormativePermissionCheck', 'FormativePermissionCheck', CFB_DOCS.permission],
  layout: ['query/FormativeLayout', 'FormativeLayout', CFB_DOCS.layout],
  create: ['mutation/FormativeTeacherAddFormativeItem', 'FormativeTeacherAddFormativeItem', CFB_DOCS.create],
  updateQuestion: ['mutation/QuestionEditableUpdateFormativeItem', 'QuestionEditableUpdateFormativeItem', CFB_DOCS.updateQuestion],
  updateText: ['mutation/TextEditableUpdate', 'TextEditableUpdate', CFB_DOCS.updateText]
};

function cfbTiptap(text) {
  return JSON.stringify({
    type: 'doc',
    attrs: { dir: 'auto' },
    content: [{
      type: 'paragraph',
      attrs: { dir: 'auto', textAlign: null },
      content: [{ type: 'text', text: String(text ?? '') }]
    }]
  });
}

function cfbFormativeId(url) {
  return String(url || '').match(/\/formatives\/([^/?#]+)/)?.[1] || '';
}

function cfbValidate(pkg) {
  const errors = [];
  if (pkg?.schema !== CFB_SCHEMA) errors.push(`Schema attendu: ${CFB_SCHEMA}.`);
  if (!pkg?.assessment || typeof pkg.assessment !== 'object') errors.push('assessment manquant.');
  if (!Array.isArray(pkg?.items)) errors.push('items doit être un tableau.');

  const ids = new Set();
  for (const item of pkg?.items || []) {
    if (!item?.id) errors.push('Chaque item doit avoir un id.');
    else if (ids.has(item.id)) errors.push(`ID dupliqué: ${item.id}.`);
    else ids.add(item.id);

    if (!['text', 'passageGroup', 'question'].includes(item?.kind)) {
      errors.push(`${item?.id || '?'}: kind non supporté.`);
    }

    if (item?.kind === 'question') {
      if (item.subtype !== 'shortAnswer') {
        errors.push(`${item.id}: seul shortAnswer est branché dans cette première bêta.`);
      }
      if (!Number.isFinite(Number(item.points))) errors.push(`${item.id}: points invalides.`);
      if (item.grading?.mode === 'keyword-absolute') {
        if (item.grading.requiresKeywordApproval !== true) {
          errors.push(`${item.id}: requiresKeywordApproval doit être true.`);
        }
        if (!Array.isArray(item.grading.matches) || !item.grading.matches.length) {
          errors.push(`${item.id}: aucun mot-clé.`);
        }
      }
    }
  }

  return { ok: !errors.length, errors };
}

async function cfbFindTab(wantedId = '') {
  const tabs = await chrome.tabs.query({ url: 'https://app.formative.com/formatives/*' });
  const sorted = [...tabs].sort((a, b) => {
    if (!!a.active !== !!b.active) return a.active ? -1 : 1;
    return Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0);
  });
  if (wantedId) {
    const exact = sorted.find(tab => cfbFormativeId(tab.url) === wantedId);
    if (exact) return exact;
  }
  return sorted.find(tab => cfbFormativeId(tab.url)) || null;
}

function cfbHeaders(tabId) {
  const tracked = formativeHeadersByTab.get(tabId) || {};
  if (!tracked.authorization) {
    throw new Error(
      'Session Formative non capturée. Fais une action dans le Formative cible, puis redétecte-le.'
    );
  }
  return {
    ...tracked,
    accept: tracked.accept || '*/*',
    'content-type': 'application/json',
    'x-tab-id': crypto.randomUUID()
  };
}

async function cfbCall(tabId, key, variables) {
  const [path, operationName, query] = CFB_OPS[key];
  const response = await fetch(`${CFB_ENDPOINT}/${path}`, {
    method: 'POST',
    headers: cfbHeaders(tabId),
    body: JSON.stringify({
      operationName,
      variables,
      extensions: {
        clientLibrary: { name: '@apollo/client', version: '4.2.12' }
      },
      query
    })
  });

  const raw = await response.text();
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  const errors = Array.isArray(json?.errors)
    ? json.errors.map(e => e?.message || JSON.stringify(e))
    : [];

  if (!response.ok || errors.length) {
    throw new Error(
      `${operationName}: HTTP ${response.status} ${errors.join(' | ') || raw.slice(0, 400)}`
    );
  }
  return json;
}

async function cfbPermission(tabId, formativeId) {
  const json = await cfbCall(tabId, 'permission', { formativeId });
  const permissions = json?.data?.formative?.viewerPermissions || [];
  if (!permissions.includes('edit')) {
    throw new Error('Permission edit non confirmée sur ce Formative.');
  }
}

async function cfbLayout(tabId, formativeId) {
  const json = await cfbCall(tabId, 'layout', { formativeId });
  const formative = json?.data?.formative;
  if (!formative?._id) throw new Error('Formative introuvable.');
  return formative;
}

async function cfbCreate(tabId, formativeId, subtype, parentId = null) {
  const variables = {
    formativeId,
    subtype,
    input: { isRequired: true, preventReuseChoices: null }
  };
  if (parentId) variables.parentId = parentId;
  const json = await cfbCall(tabId, 'create', variables);
  const id = json?.data?.payload?.formativeItem?._id;
  if (!id) throw new Error(`Création ${subtype}: aucun ID retourné.`);
  return id;
}

async function cfbUpdateQuestion(tabId, id, input) {
  return cfbCall(tabId, 'updateQuestion', {
    formativeItemId: id,
    input,
    withHasItemTags: false
  });
}

async function cfbUpdateText(tabId, id, text) {
  return cfbCall(tabId, 'updateText', {
    formativeItemId: id,
    text: cfbTiptap(text)
  });
}

function cfbMatches(item) {
  return (item?.grading?.matches || [])
    .filter(m => m?.enabled !== false)
    .map(m => ({
      text: String(m?.text || '').trim(),
      score: Math.round((Number(m?.score) + Number.EPSILON) * 10) / 10
    }))
    .filter(m => m.text && Number.isFinite(m.score));
}

async function cfbConfigureShortAnswer(tabId, id, item) {
  await cfbUpdateQuestion(tabId, id, {
    text: cfbTiptap(item.prompt || ''),
    isCaseSensitive: item.grading?.caseSensitive === true,
    isRequired: item.isRequired !== false
  });

  await cfbUpdateQuestion(tabId, id, {
    points: Math.round((Number(item.points) + Number.EPSILON) * 10) / 10
  });

  if (item.grading?.mode === 'keyword-absolute') {
    if (item.grading.reviewApproved !== true) {
      throw new Error(`${item.id}: mots-clés non validés.`);
    }
    const matches = cfbMatches(item);
    if (!matches.length) throw new Error(`${item.id}: aucun mot-clé actif.`);
    await cfbUpdateQuestion(tabId, id, {
      correctAnswers: matches.map(x => x.text),
      answerChoicePoints: matches.map(x => x.score),
      isKeywordGrading: true,
      isPartialCredit: true,
      isCaseSensitive: item.grading?.caseSensitive === true
    });
  }
}

function cfbPackageKey(pkg) {
  return String(
    pkg?.assessment?.id ||
    pkg?.assessment?.sourceFile ||
    pkg?.assessment?.title ||
    'assessment'
  ).trim();
}

function cfbStorageKey(formativeId, pkg) {
  return `cardinalFormativeMap:${formativeId}:${cfbPackageKey(pkg)}`;
}

async function cfbGetMap(formativeId, pkg) {
  const key = cfbStorageKey(formativeId, pkg);
  const data = await chrome.storage.local.get(key);
  return { key, map: data[key] || { items: {} } };
}

function cfbNormalizeForHash(item, parentKey = null) {
  const clone = structuredClone(item);
  if (clone?.grading?.matches) {
    clone.grading.matches = clone.grading.matches
      .filter(m => m?.enabled !== false)
      .map(m => ({
        text: String(m.text || '').trim(),
        score: Number(m.score),
        enabled: true
      }));
  }
  return { item: clone, parentKey };
}

function cfbStable(value) {
  if (Array.isArray(value)) return value.map(cfbStable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = cfbStable(value[key]);
      return out;
    }, {});
  }
  return value;
}

async function cfbHash(item, parentKey = null) {
  const bytes = new TextEncoder().encode(JSON.stringify(cfbStable(cfbNormalizeForHash(item, parentKey))));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function cfbQuestionById(pkg, id) {
  return (pkg.items || []).find(
    item => item?.kind === 'question' && String(item.id) === String(id)
  ) || null;
}

function cfbPassageChildren(pkg, passage) {
  if (!Array.isArray(passage?.questions)) return [];
  return passage.questions.map(value => {
    if (value && typeof value === 'object') return value;
    return cfbQuestionById(pkg, value);
  }).filter(Boolean);
}

async function cfbPrepare(pkg, wantedId = '') {
  const validation = cfbValidate(pkg);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));

  const tab = await cfbFindTab(wantedId);
  if (!tab?.id) throw new Error('Ouvre le Formative cible dans un onglet.');

  const formativeId = cfbFormativeId(tab.url);
  if (!formativeId) throw new Error('ID Formative introuvable.');
  if (wantedId && formativeId !== wantedId) {
    throw new Error('Le Formative ouvert ne correspond pas à la cible.');
  }

  await cfbPermission(tab.id, formativeId);
  const layout = await cfbLayout(tab.id, formativeId);
  const existing = new Set((layout.items || []).map(x => x?._id).filter(Boolean));
  const { map } = await cfbGetMap(formativeId, pkg);
  const entries = [];
  const children = new Set();

  for (const passage of pkg.items.filter(x => x?.kind === 'passageGroup')) {
    for (const child of cfbPassageChildren(pkg, passage)) children.add(child.id);
  }

  async function one(item, parentKey = null) {
    const old = map.items?.[item.id] || null;
    const desiredHash = await cfbHash(item, parentKey);
    let action = 'create';
    let existingId = null;

    if (old?.formativeItemId && existing.has(old.formativeItemId)) {
      existingId = old.formativeItemId;
      action = old.hash === desiredHash ? 'unchanged' : 'update';
    }

    let blockedReason = '';
    if (item.kind === 'question' && item.subtype !== 'shortAnswer') {
      action = 'blocked';
      blockedReason = `Subtype ${item.subtype} pas encore branché dans cette bêta.`;
    }
    if (
      item.kind === 'question' &&
      item.grading?.mode === 'keyword-absolute' &&
      item.grading.reviewApproved !== true
    ) {
      action = 'blocked';
      blockedReason = 'Mots-clés non validés.';
    }

    entries.push({
      id: item.id,
      kind: item.kind,
      subtype: item.kind === 'question' ? item.subtype : 'functionalizedText',
      parentKey,
      action,
      existingId,
      desiredHash,
      blockedReason
    });
  }

  for (const item of pkg.items) {
    if (item.kind === 'passageGroup') {
      await one(item, null);
      for (const child of cfbPassageChildren(pkg, item)) await one(child, item.id);
      continue;
    }
    if (item.kind === 'question' && children.has(item.id)) continue;
    await one(item, null);
  }

  return {
    formativeId,
    formativeTitle: layout.title || '',
    tabId: tab.id,
    entries,
    counts: {
      create: entries.filter(x => x.action === 'create').length,
      update: entries.filter(x => x.action === 'update').length,
      unchanged: entries.filter(x => x.action === 'unchanged').length,
      blocked: entries.filter(x => x.action === 'blocked').length
    }
  };
}

async function cfbApply(pkg, formativeId) {
  const plan = await cfbPrepare(pkg, formativeId);
  if (plan.counts.blocked) throw new Error('Le plan contient des éléments bloqués.');

  const tab = await chrome.tabs.get(plan.tabId);
  await focusTab(tab);

  const { key, map } = await cfbGetMap(plan.formativeId, pkg);
  map.items ||= {};
  const byId = new Map(plan.entries.map(e => [e.id, e]));
  const childIds = new Set();
  const results = [];

  for (const passage of pkg.items.filter(x => x?.kind === 'passageGroup')) {
    for (const child of cfbPassageChildren(pkg, passage)) childIds.add(child.id);
  }

  async function textLike(item, entry) {
    if (entry.action === 'unchanged') {
      results.push({ id: item.id, action: 'unchanged', formativeItemId: entry.existingId });
      return entry.existingId;
    }

    let id = entry.existingId;
    if (!id) id = await cfbCreate(plan.tabId, plan.formativeId, 'functionalizedText');

    await cfbUpdateText(
      plan.tabId,
      id,
      item.kind === 'passageGroup' ? (item.passage || '') : (item.content || '')
    );

    map.items[item.id] = {
      formativeItemId: id,
      subtype: 'functionalizedText',
      hash: entry.desiredHash
    };
    results.push({ id: item.id, action: entry.action, formativeItemId: id });
    return id;
  }

  async function question(item, entry, parentId = null) {
    if (entry.action === 'unchanged') {
      results.push({ id: item.id, action: 'unchanged', formativeItemId: entry.existingId, parentId });
      return entry.existingId;
    }

    let id = entry.existingId;
    if (!id) {
      id = await cfbCreate(plan.tabId, plan.formativeId, 'shortAnswer', parentId);
    }
    await cfbConfigureShortAnswer(plan.tabId, id, item);

    map.items[item.id] = {
      formativeItemId: id,
      subtype: 'shortAnswer',
      parentId: parentId || null,
      hash: entry.desiredHash
    };
    results.push({ id: item.id, action: entry.action, formativeItemId: id, parentId });
    return id;
  }

  for (const item of pkg.items) {
    if (item.kind === 'passageGroup') {
      const parentId = await textLike(item, byId.get(item.id));
      for (const child of cfbPassageChildren(pkg, item)) {
        await question(child, byId.get(child.id), parentId);
      }
      continue;
    }

    if (item.kind === 'question' && childIds.has(item.id)) continue;
    if (item.kind === 'text') await textLike(item, byId.get(item.id));
    if (item.kind === 'question') await question(item, byId.get(item.id), null);
  }

  await chrome.storage.local.set({ [key]: map });

  return {
    ok: true,
    formativeId: plan.formativeId,
    formativeTitle: plan.formativeTitle,
    counts: plan.counts,
    results
  };
}

async function cfbStore(pkg) {
  const validation = cfbValidate(pkg);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  await chrome.storage.session.set({
    cardinalFormativePendingPackage: pkg,
    cardinalFormativePendingAt: Date.now()
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  if (!type.startsWith('CARDINAL_FORMATIVE_BUILDER_')) return;

  (async () => {
    if (type === 'CARDINAL_FORMATIVE_BUILDER_CAPTURE') {
      await cfbStore(message.payload);
      const url = chrome.runtime.getURL('formative-builder.html');
      const existing = await chrome.tabs.query({ url });
      if (existing[0]?.id) {
        await chrome.tabs.update(existing[0].id, { active: true });
        try { await chrome.windows.update(existing[0].windowId, { focused: true }); } catch {}
      } else {
        await chrome.tabs.create({ url, active: true });
      }
      return { ok: true };
    }

    if (type === 'CARDINAL_FORMATIVE_BUILDER_GET_PACKAGE') {
      const data = await chrome.storage.session.get('cardinalFormativePendingPackage');
      return { ok: true, payload: data.cardinalFormativePendingPackage || null };
    }

    if (type === 'CARDINAL_FORMATIVE_BUILDER_SAVE_PACKAGE') {
      await cfbStore(message.payload);
      return { ok: true };
    }

    if (type === 'CARDINAL_FORMATIVE_BUILDER_FIND_TARGET') {
      const tab = await cfbFindTab(message.formativeId || '');
      if (!tab?.id) return { ok: false, message: 'Aucun Formative ouvert.' };
      return {
        ok: true,
        formativeId: cfbFormativeId(tab.url),
        title: tab.title || '',
        hasSession: formativeHeadersByTab.has(tab.id)
      };
    }

    if (type === 'CARDINAL_FORMATIVE_BUILDER_PREPARE') {
      const plan = await cfbPrepare(message.payload, message.formativeId || '');
      return { ok: true, plan };
    }

    if (type === 'CARDINAL_FORMATIVE_BUILDER_APPLY') {
      return cfbApply(message.payload, message.formativeId || '');
    }

    throw new Error('Action Formative Builder inconnue.');
  })()
    .then(result => sendResponse(result))
    .catch(error => sendResponse({ ok: false, message: error?.message || String(error) }));

  return true;
});
