const DATA_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-results";
const AUTH_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-student-auth";
const TEACHER_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-teacher-api";
const SYNC_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/mozaik-sync";
const PUBLIC_KEY = "sb_publishable_mI94i3exzVPlHveGFX1WOw_1Ucab3_f";
const PAGE_SOURCE = "cardinal-mozaik-console";
const EXT_SOURCE = "cardinal-mozaik-extension";
const $ = id => document.getElementById(id);

const state = {
  loginMode: "email",
  email: "",
  teacherToken: localStorage.getItem("results_teacher_token") || "",
  studentToken: sessionStorage.getItem("results_student_token") || "",
  teacherAssignments: [],
  groupStats: {},
  currentAssignment: null,
  currentStudents: [],
  currentStudent: null,
  detailGroup: "",
  extensionReady: false,
  extensionVersion: "",
  syncLinks: [],
  dashboardGroup: localStorage.getItem("results_dashboard_group") || "51",
};

const pendingExtension = new Map();
let toastTimer = null;

async function api(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", apikey: PUBLIC_KEY },
    body: JSON.stringify(payload),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || !data.ok) throw new Error(data.message || "Une erreur est survenue.");
  return data;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
function formatNumber(v, digits = 2) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toLocaleString("fr-CA", { maximumFractionDigits: digits });
}
function competenceLabel(k) {
  return k === "lecture" ? "Lire" : k === "ecriture" ? "Écrire" : k === "oral" ? "Communiquer oralement" : "Compétence";
}
function competencyArray(k) {
  return k === "lecture" ? ["Lecture"] : k === "ecriture" ? ["Écriture"] : k === "oral" ? ["Communication orale"] : [];
}
function today() { return new Date().toISOString().slice(0, 10); }
function show(el, on = true) { el?.classList.toggle("hidden", !on); }
function decimalPlaces(value) {
  const s = String(value ?? "");
  if (!s.includes(".")) return 0;
  return s.split(".")[1].replace(/0+$/, "").length;
}
function notify(message, type = "success") {
  const el = $("toast");
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = message;
  el.className = `toast ${type}`;
  toastTimer = setTimeout(() => el.classList.add("hidden"), type === "error" ? 7000 : 4200);
}

async function loadBrandIcon() {
  try {
    const r = await fetch("assets/sync-icon.b64", { cache: "force-cache" });
    if (!r.ok) return;
    const b64 = (await r.text()).trim();
    const src = "data:image/png;base64," + b64;
    document.querySelectorAll("[data-sync-icon]").forEach(img => img.src = src);
    const fav = $("syncFavicon");
    if (fav) fav.href = src;
  } catch {}
}
loadBrandIcon();

function announceExtension(ok, version = "") {
  state.extensionReady = ok;
  state.extensionVersion = version || state.extensionVersion;
  const el = $("extensionStatus");
  if (!el) return;
  el.classList.toggle("ok", ok);
  el.textContent = ok ? `Extension v${state.extensionVersion || "?"}` : "Extension non détectée";
}
function pingExtension() {
  window.postMessage({ source: PAGE_SOURCE, type: "MOZAIK_EXTENSION_PING" }, location.origin);
}
window.addEventListener("message", e => {
  if (e.source !== window || e.origin !== location.origin || e.data?.source !== EXT_SOURCE) return;
  if (e.data.type === "MOZAIK_EXTENSION_READY") {
    announceExtension(true, String(e.data.version || ""));
    return;
  }
  if (e.data.type === "MOZAIK_EXTENSION_RESULT") {
    const id = String(e.data.requestId || "");
    const pending = pendingExtension.get(id);
    if (!pending) return;
    pendingExtension.delete(id);
    clearTimeout(pending.timer);
    pending.resolve(e.data.result);
  }
});
function sendToExtension(payload) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingExtension.delete(requestId);
      reject(new Error("La synchronisation avec Mozaïk a expiré. Vérifie que le portail est ouvert et connecté."));
    }, 180000);
    pendingExtension.set(requestId, { resolve, reject, timer });
    window.postMessage({ source: PAGE_SOURCE, type: "MOZAIK_EXTENSION_SYNC", requestId, payload }, location.origin);
  });
}

const bootView = $("bootView");
const loginView = $("loginView");
const studentView = $("studentView");
const teacherView = $("teacherView");
const loginForm = $("loginForm");
const emailInput = $("emailInput");
const credentialBlock = $("credentialBlock");
const credentialLabel = $("credentialLabel");
const credentialInput = $("credentialInput");
const credentialHint = $("credentialHint");
const loginBtn = $("loginBtn");
const loginError = $("loginError");
const logoutBtn = $("logoutBtn");
const authExtra = document.createElement("div");
authExtra.id = "authExtra";
credentialBlock.appendChild(authExtra);

function buttonLabel() {
  if (state.loginMode === "email") return "Continuer";
  if (state.loginMode === "activate") return "Activer mon compte";
  if (state.loginMode === "reset") return "Choisir ce nouveau mot de passe";
  return "Se connecter";
}
function setLoading(on, label = "Chargement...") {
  loginBtn.disabled = on;
  loginBtn.textContent = on ? label : buttonLabel();
}
function clearError() { loginError.textContent = ""; show(loginError, false); }
function showError(m) { loginError.textContent = m; show(loginError, true); }
function resetCredentialUi() {
  show(credentialBlock, false);
  credentialInput.value = "";
  authExtra.innerHTML = "";
  credentialHint.textContent = "";
}
function addPasswordFields(reset = false) {
  authExtra.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="field-label" for="newPassword">${reset ? "Nouveau mot de passe" : "Crée un mot de passe"}</label><input id="newPassword" class="input" type="password" autocomplete="new-password"></div><div><label class="field-label" for="confirmPassword">Confirme le mot de passe</label><input id="confirmPassword" class="input" type="password" autocomplete="new-password"></div></div><div class="hint">Minimum 8 caractères.</div>`;
}
function configureMode(mode) {
  state.loginMode = mode;
  show(credentialBlock, true);
  authExtra.innerHTML = "";
  credentialInput.value = "";
  if (mode === "teacher") {
    credentialLabel.textContent = "Mot de passe enseignant";
    credentialInput.type = "password";
    credentialInput.autocomplete = "current-password";
    credentialHint.textContent = "Utilise le mot de passe de cette plateforme.";
  } else if (mode === "password") {
    credentialLabel.textContent = "Mot de passe";
    credentialInput.type = "password";
    credentialInput.autocomplete = "current-password";
    credentialHint.textContent = "Ton compte est déjà activé.";
    authExtra.innerHTML = '<button id="forgotBtn" class="btn btn-ghost" style="margin-top:8px" type="button">Mot de passe oublié?</button>';
    $("forgotBtn").onclick = () => configureMode("reset");
  } else if (mode === "activate") {
    credentialLabel.textContent = "Numéro de fiche";
    credentialInput.inputMode = "numeric";
    credentialHint.textContent = "Première connexion : entre ton numéro de fiche, puis choisis ton mot de passe.";
    addPasswordFields(false);
  } else if (mode === "reset") {
    credentialLabel.textContent = "Numéro de fiche";
    credentialInput.inputMode = "numeric";
    credentialHint.textContent = "Confirme ton identité avec ton numéro de fiche.";
    addPasswordFields(true);
  }
  loginBtn.textContent = buttonLabel();
  credentialInput.focus();
}

loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  clearError();
  try {
    if (state.loginMode === "email") {
      const email = emailInput.value.trim().toLowerCase();
      if (!email.includes("@")) throw new Error("Entre ton adresse courriel complète.");
      state.email = email;
      setLoading(true, "Vérification...");
      if (email.endsWith("@educ.cscapitale.qc.ca")) {
        const d = await api(AUTH_ENDPOINT, { action: "mode", email });
        configureMode(d.mode);
      } else {
        configureMode("teacher");
      }
      return;
    }
    if (state.loginMode === "teacher") {
      setLoading(true, "Connexion...");
      const d = await api(TEACHER_ENDPOINT, { action: "login", email: state.email, password: credentialInput.value });
      state.teacherToken = d.token;
      localStorage.setItem("results_teacher_token", d.token);
      await loadTeacherDashboard();
      return;
    }
    if (state.loginMode === "password") {
      setLoading(true, "Connexion...");
      const d = await api(AUTH_ENDPOINT, { action: "login", email: state.email, password: credentialInput.value });
      state.studentToken = d.token;
      sessionStorage.setItem("results_student_token", d.token);
      await loadStudentDashboard();
      return;
    }
    if (state.loginMode === "activate" || state.loginMode === "reset") {
      const p = $("newPassword")?.value || "";
      const c = $("confirmPassword")?.value || "";
      if (p.length < 8) throw new Error("Choisis un mot de passe d’au moins 8 caractères.");
      if (p !== c) throw new Error("Les deux mots de passe ne sont pas identiques.");
      setLoading(true, "Enregistrement...");
      const d = await api(AUTH_ENDPOINT, {
        action: state.loginMode === "activate" ? "activate" : "reset",
        email: state.email,
        fiche: credentialInput.value.trim(),
        password: p,
      });
      state.studentToken = d.token;
      sessionStorage.setItem("results_student_token", d.token);
      await loadStudentDashboard();
    }
  } catch (err) {
    showError(err.message || "Une erreur est survenue.");
  } finally {
    setLoading(false);
  }
});

emailInput.addEventListener("input", () => {
  if (state.loginMode !== "email") {
    state.loginMode = "email";
    resetCredentialUi();
    loginBtn.textContent = "Continuer";
    clearError();
  }
});

logoutBtn.addEventListener("click", async () => {
  const old = state.teacherToken;
  localStorage.removeItem("results_teacher_token");
  sessionStorage.removeItem("results_student_token");
  Object.assign(state, { teacherToken: "", studentToken: "", loginMode: "email", email: "" });
  emailInput.value = "";
  resetCredentialUi();
  show(bootView, false);
  show(studentView, false);
  show(teacherView, false);
  show(loginView, true);
  show(logoutBtn, false);
  if (old) {
    try { await api(TEACHER_ENDPOINT, { action: "logout", token: old }); } catch {}
  }
});

async function loadStudentDashboard() {
  const d = await api(DATA_ENDPOINT, { action: "studentDashboard", token: state.studentToken });
  show(bootView, false);
  show(loginView, false);
  show(teacherView, false);
  show(studentView, true);
  show(logoutBtn, true);
  $("studentName").textContent = d.user.name;
  $("studentMeta").textContent = `${d.user.email} · Groupe ${d.user.group}`;
  const graded = d.assignments.filter(a => a.result && a.result.grade !== null);
  $("studentSummary").innerHTML = `<strong>${graded.length}</strong><span>résultat${graded.length === 1 ? "" : "s"}</span>`;
  $("studentAssignments").innerHTML = d.assignments.length ? d.assignments.map(a => `
    <article class="card student-card">
      <div class="eyebrow">${a.result ? "Travail corrigé" : "Travail"}</div>
      <h2>${esc(a.title)}</h2>
      <div class="meta-row">
        <span class="pill">${(a.competencies || []).map(esc).join(" · ") || "Français"}</span>
        ${a.weight !== null ? `<span class="pill gray">${a.weight}%</span>` : ""}
      </div>
      ${a.result ? `<h3>${a.result.grade === null ? "Non noté" : `${formatNumber(a.result.grade)} / ${formatNumber(a.maxScore)}`}</h3>${a.result.feedback ? `<p>${esc(a.result.feedback)}</p>` : ""}` : `<p class="muted">Aucun résultat publié.</p>`}
    </article>`).join("") : '<div class="card" style="padding:28px">Aucun travail publié pour le moment.</div>';
}

function setTeacherSection(name) {
  show($("teacherDashboard"), name === "dashboard");
  show($("assignmentsView"), name === "assignments");
  show($("assignmentDetail"), name === "detail");
  document.querySelectorAll(".nav-item[data-teacher-view]").forEach(b => b.classList.toggle("active", b.dataset.teacherView === name));
}

document.querySelectorAll(".nav-item[data-teacher-view]").forEach(b => b.onclick = () => {
  if (b.dataset.teacherView === "dashboard") {
    setTeacherSection("dashboard");
    renderDashboard();
  } else {
    setTeacherSection("assignments");
    renderAssignmentList();
  }
});

document.querySelectorAll(".group-nav").forEach(b => b.onclick = () => selectDashboardGroup(b.dataset.group, true));

function selectDashboardGroup(group, openAssignments = false) {
  state.dashboardGroup = group;
  localStorage.setItem("results_dashboard_group", group);
  document.querySelectorAll(".group-nav").forEach(b => b.classList.toggle("active", b.dataset.group === group));
  if (openAssignments) {
    $("assignmentGroupFilter").value = group;
    setTeacherSection("assignments");
    renderAssignmentList();
  } else {
    renderDashboard();
  }
}

async function refreshTeacherData() {
  const d = await api(TEACHER_ENDPOINT, { action: "teacherDashboard", token: state.teacherToken });
  state.teacherAssignments = d.assignments || [];
  state.groupStats = d.groups || {};
}

async function loadTeacherDashboard() {
  await refreshTeacherData();
  show(bootView, false);
  show(loginView, false);
  show(studentView, false);
  show(teacherView, true);
  show(logoutBtn, true);
  setTeacherSection("dashboard");
  renderDashboard();
  renderAssignmentList();
  setTimeout(pingExtension, 150);
}

function renderDashboard() {
  const selected = state.dashboardGroup || "51";
  document.querySelectorAll(".group-nav").forEach(b => b.classList.toggle("active", b.dataset.group === selected));
  $("groupStats").innerHTML = ["31", "32", "51"].map(g => `
    <button class="card stat-card stat-button ${g === selected ? "selected" : ""}" data-dashboard-group="${g}" type="button">
      <div class="eyebrow">Groupe ${g}</div>
      <div class="big">${state.groupStats[g] || 0}</div>
      <div class="muted">élèves</div>
    </button>`).join("");
  document.querySelectorAll("[data-dashboard-group]").forEach(b => b.onclick = () => selectDashboardGroup(b.dataset.dashboardGroup, false));

  const term = 1;
  const kinds = ["lecture", "ecriture", "oral"];
  $("weightOverview").innerHTML = kinds.map(k => {
    const total = state.teacherAssignments
      .filter(a => a.groups.includes(selected) && Number(a.term || 1) === term && a.competenceKind === k)
      .reduce((sum, a) => sum + Number(a.weight || 0), 0);
    const pct = Math.min(total, 100);
    return `<div class="card weight-card"><div class="eyebrow">Étape ${term}</div><h3>${competenceLabel(k)}</h3><div class="progress"><span style="width:${pct}%"></span></div><div class="weight-line"><strong>${formatNumber(total)} / 100 %</strong><span class="muted">${total > 100 ? `+${formatNumber(total - 100)} %` : `${formatNumber(Math.max(0, 100 - total))} % restant`}</span></div></div>`;
  }).join("");

  const list = state.teacherAssignments.filter(a => a.groups.includes(selected)).slice(0, 8);
  $("recentTitle").textContent = `Travaux du groupe ${selected}`;
  $("recentAssignments").innerHTML = assignmentCards(list);
  wireAssignmentCards($("recentAssignments"));
}

function assignmentCards(list) {
  if (!list.length) return '<div class="card" style="padding:28px">Aucun travail pour ce groupe.</div>';
  return list.map(a => `
    <article class="card assignment-card" data-id="${a.id}">
      <div>
        <h3>${esc(a.title)}</h3>
        <div class="assignment-meta">
          <span class="pill">${competenceLabel(a.competenceKind)}</span>
          <span class="pill gray">Groupe${a.groups.length > 1 ? "s" : ""} ${a.groups.join(", ")}</span>
          ${a.weight !== null ? `<span class="pill gray">${formatNumber(a.weight)} %</span>` : ""}
          <span class="pill ${a.mozaikSyncStatus === "synced" ? "green" : a.mozaikSyncStatus === "dirty" ? "amber" : a.mozaikSyncStatus === "error" ? "red" : "gray"}">${a.mozaikSyncStatus === "synced" ? "Mozaïk synchronisé" : a.mozaikSyncStatus === "dirty" ? "Modifié" : a.mozaikSyncStatus === "error" ? "Erreur Mozaïk" : "Non synchronisé"}</span>
        </div>
      </div>
      <div class="assignment-side">
        <div class="metric"><strong>${a.gradedCount}/${a.studentCount}</strong><span class="muted">notes</span></div>
        <div class="metric"><strong>${a.average === null ? "-" : formatNumber(a.average)}</strong><span class="muted">moyenne</span></div>
      </div>
    </article>`).join("");
}

function wireAssignmentCards(root) {
  root?.querySelectorAll(".assignment-card").forEach(c => c.onclick = () => openAssignment(c.dataset.id));
}

function renderAssignmentList() {
  const q = $("assignmentSearch")?.value.trim().toLowerCase() || "";
  const g = $("assignmentGroupFilter")?.value || "";
  const k = $("assignmentCompetenceFilter")?.value || "";
  const list = state.teacherAssignments.filter(a => (!q || a.title.toLowerCase().includes(q)) && (!g || a.groups.includes(g)) && (!k || a.competenceKind === k));
  $("assignmentList").innerHTML = assignmentCards(list);
  wireAssignmentCards($("assignmentList"));
}

["assignmentSearch", "assignmentGroupFilter", "assignmentCompetenceFilter"].forEach(id => $(id)?.addEventListener("input", renderAssignmentList));
$("showAllAssignments").onclick = () => {
  $("assignmentGroupFilter").value = state.dashboardGroup || "";
  setTeacherSection("assignments");
  renderAssignmentList();
};

function newAssignment() {
  state.currentAssignment = {
    id: null,
    title: "Nouveau travail",
    competencies: ["Lecture"],
    competenceKind: "lecture",
    weight: null,
    maxScore: 10,
    groups: [state.dashboardGroup || "51"],
    published: false,
    instructions: "",
    term: 1,
    activityDate: today(),
    activityType: "Évaluation",
    reportCardEnabled: false,
    resultsVisible: false,
    showInSchedule: true,
    homework: false,
    period: 3,
    mozaikSyncStatus: "not_synced",
  };
  state.currentStudents = [];
  state.detailGroup = state.currentAssignment.groups[0];
  setTeacherSection("detail");
  fillWorkPage();
  renderGradeRows();
  $("syncMozaikBtn").disabled = true;
}
$("newAssignmentBtn").onclick = newAssignment;
$("newAssignmentBtn2").onclick = newAssignment;

$("backToAssignments").onclick = async () => {
  await refreshTeacherData();
  $("assignmentGroupFilter").value = state.detailGroup || state.dashboardGroup || "";
  setTeacherSection("assignments");
  renderAssignmentList();
};

async function openAssignment(id) {
  const d = await api(TEACHER_ENDPOINT, { action: "teacherAssignment", token: state.teacherToken, assignmentId: id });
  state.currentAssignment = d.assignment;
  state.currentStudents = d.students || [];
  state.detailGroup = state.currentAssignment.groups[0] || "";
  setTeacherSection("detail");
  fillWorkPage();
  renderGradeRows();
  await refreshSyncState();
  setTimeout(pingExtension, 100);
}

function updateVisibilityLabels() {
  const published = $("topPublishedToggle").checked;
  const mozaik = $("topMozaikVisibleToggle").checked;
  $("platformVisibilityText").textContent = published ? "Visible" : "Masqué";
  $("mozaikVisibilityText").textContent = mozaik ? "Visible" : "Masqué";
}

function fillWorkPage() {
  const a = state.currentAssignment;
  if (!a) return;
  $("workTitle").textContent = a.title;
  $("workMeta").innerHTML = `<span class="pill">${competenceLabel(a.competenceKind)}</span><span class="pill gray">Étape ${a.term || 1}</span>${a.weight !== null ? `<span class="pill gray">${formatNumber(a.weight)} %</span>` : ""}<span class="pill gray">Note sur ${formatNumber(a.maxScore)}</span>`;
  $("detailGroupSelect").innerHTML = a.groups.map(g => `<option value="${g}">Groupe ${g}</option>`).join("");
  $("detailGroupSelect").value = state.detailGroup || a.groups[0] || "";
  $("editTitle").value = a.title || "";
  $("editCompetenceKind").value = a.competenceKind || "lecture";
  $("editActivityType").value = [...$("editActivityType").options].some(o => o.value === a.activityType) ? a.activityType : "Autre";
  $("editMaxScore").value = a.maxScore ?? 10;
  $("editWeight").value = a.weight ?? "";
  $("editTerm").value = String(a.term || 1);
  $("editActivityDate").value = a.activityDate || today();
  $("editPeriod").value = a.period || 3;
  $("topPublishedToggle").checked = !!a.published;
  $("topMozaikVisibleToggle").checked = !!a.resultsVisible;
  $("editReportCard").checked = !!a.reportCardEnabled;
  $("editShowSchedule").checked = a.showInSchedule !== false;
  $("editHomework").checked = !!a.homework;
  $("editInstructions").value = a.instructions || "";
  document.querySelectorAll("#groupChoices input").forEach(i => i.checked = a.groups.includes(i.value));
  $("syncMozaikBtn").disabled = !a.id;
  updateVisibilityLabels();
}

function collectAssignment() {
  const kind = $("editCompetenceKind").value;
  return {
    id: state.currentAssignment?.id || null,
    title: $("editTitle").value.trim(),
    competenceKind: kind,
    competencies: competencyArray(kind),
    weight: $("editWeight").value === "" ? null : Number($("editWeight").value),
    maxScore: Number($("editMaxScore").value || 10),
    groups: [...document.querySelectorAll("#groupChoices input:checked")].map(i => i.value),
    published: $("topPublishedToggle").checked,
    instructions: $("editInstructions").value,
    term: Number($("editTerm").value),
    activityDate: $("editActivityDate").value,
    activityType: $("editActivityType").value,
    reportCardEnabled: $("editReportCard").checked,
    resultsVisible: $("topMozaikVisibleToggle").checked,
    showInSchedule: $("editShowSchedule").checked,
    homework: $("editHomework").checked,
    period: Number($("editPeriod").value || 3),
  };
}

async function saveAssignmentSettings({ quiet = false } = {}) {
  const payload = collectAssignment();
  if (!quiet) $("saveState").textContent = "Enregistrement...";
  const d = await api(TEACHER_ENDPOINT, { action: "saveAssignment", token: state.teacherToken, assignment: payload });
  if (!quiet) $("saveState").textContent = "Enregistré";
  const updated = await api(TEACHER_ENDPOINT, { action: "teacherAssignment", token: state.teacherToken, assignmentId: d.id });
  state.currentAssignment = updated.assignment;
  state.currentStudents = updated.students || state.currentStudents;
  state.detailGroup = state.currentAssignment.groups.includes(state.detailGroup) ? state.detailGroup : state.currentAssignment.groups[0];
  fillWorkPage();
  renderGradeRows();
  await refreshSyncState();
  return state.currentAssignment;
}

$("saveAssignmentBtn").onclick = async () => {
  try {
    await saveAssignmentSettings();
    notify("Paramètres enregistrés.");
  } catch (e) {
    $("saveState").textContent = "";
    notify(e.message, "error");
  }
};

async function saveTopVisibility() {
  updateVisibilityLabels();
  if (!state.currentAssignment?.id) return;
  try {
    $("saveState").textContent = "Enregistrement...";
    await saveAssignmentSettings({ quiet: true });
    $("saveState").textContent = "Enregistré";
    notify("Visibilité mise à jour.");
  } catch (e) {
    fillWorkPage();
    notify(e.message, "error");
  }
}
$("topPublishedToggle").addEventListener("change", saveTopVisibility);
$("topMozaikVisibleToggle").addEventListener("change", saveTopVisibility);

$("detailGroupSelect").onchange = async () => {
  state.detailGroup = $("detailGroupSelect").value;
  renderGradeRows();
  await refreshSyncState();
};
$("studentSearch").addEventListener("input", renderGradeRows);

function gradeValue(raw, max) {
  let s = String(raw ?? "").trim();
  if (!s) return { grade: null, text: "" };
  if (s.includes("/")) s = s.split("/")[0].trim();
  s = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error("Entre une note valide.");
  if (n < 0 || n > Number(max)) throw new Error(`La note doit être entre 0 et ${formatNumber(max)}.`);
  return { grade: n, text: formatNumber(n, 3) };
}
function updatePercent(input, grade) {
  const td = input.closest("tr")?.querySelector(".percent-value");
  if (td) td.textContent = grade === null ? "-" : `${formatNumber((grade / Number(state.currentAssignment.maxScore)) * 100, 1)} %`;
}
function visibleStudents() {
  const q = $("studentSearch").value.trim().toLowerCase();
  const g = state.detailGroup;
  return state.currentStudents
    .filter(s => (!g || s.group === g) && (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr", { sensitivity: "base" }) || a.firstName.localeCompare(b.firstName, "fr", { sensitivity: "base" }));
}
function renderGradeRows() {
  if (!state.currentAssignment) return;
  const list = visibleStudents();
  const max = state.currentAssignment.maxScore;
  $("studentRows").innerHTML = list.length ? list.map(s => `
    <tr data-email="${esc(s.email)}">
      <td class="student-last">${esc(s.lastName || s.name)}</td>
      <td>${esc(s.firstName || "")}</td>
      <td><div class="grade-input-wrap"><input class="grade-input" type="text" inputmode="decimal" autocomplete="off" data-email="${esc(s.email)}" value="${s.grade === null ? "" : formatNumber(s.grade, 3)}"><span class="max-score">/ ${formatNumber(max)}</span></div></td>
      <td><span class="percent-value">${s.grade === null ? "-" : `${formatNumber((Number(s.grade) / Number(max)) * 100, 1)} %`}</span></td>
      <td><button class="detail-btn" tabindex="-1" data-email="${esc(s.email)}" type="button">•••</button></td>
    </tr>`).join("") : `<tr><td colspan="5" style="padding:28px;text-align:center;color:#67758a">Aucun élève.</td></tr>`;
  wireGradeInputs();
}
function wireGradeInputs() {
  const inputs = [...document.querySelectorAll(".grade-input")];
  inputs.forEach((input, index) => {
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => {
      if (input.value.includes(".")) {
        const p = input.selectionStart;
        input.value = input.value.replace(/\./g, ",");
        try { input.setSelectionRange(p, p); } catch {}
      }
    });
    input.addEventListener("blur", () => commitGrade(input));
    input.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== "Tab") return;
      e.preventDefault();
      commitGrade(input);
      const dir = e.shiftKey ? -1 : 1;
      const next = inputs[index + dir];
      if (next) {
        next.focus();
        next.select();
      }
    });
  });
  document.querySelectorAll(".detail-btn").forEach(b => b.onclick = () => openStudentDialog(b.dataset.email));
}
async function commitGrade(input) {
  const email = input.dataset.email;
  const s = state.currentStudents.find(x => x.email === email);
  if (!s) return;
  let parsed;
  try {
    parsed = gradeValue(input.value, state.currentAssignment.maxScore);
  } catch (e) {
    input.classList.add("error");
    $("gradeSaveState").textContent = e.message;
    setTimeout(() => {
      input.value = s.grade === null ? "" : formatNumber(s.grade, 3);
      input.classList.remove("error");
    }, 1000);
    return;
  }
  const old = s.grade;
  if ((old === null && parsed.grade === null) || (old !== null && parsed.grade !== null && Number(old) === Number(parsed.grade))) {
    input.value = parsed.text;
    return;
  }
  s.grade = parsed.grade;
  input.value = parsed.text;
  input.classList.remove("error", "saved");
  input.classList.add("saving");
  updatePercent(input, parsed.grade);
  $("gradeSaveState").textContent = "Enregistrement...";
  try {
    await api(TEACHER_ENDPOINT, {
      action: "saveResult",
      token: state.teacherToken,
      assignmentId: state.currentAssignment.id,
      email: s.email,
      response: s.response,
      grade: parsed.grade,
      feedback: s.feedback,
      visible: true,
    });
    input.classList.remove("saving");
    input.classList.add("saved");
    $("gradeSaveState").textContent = "Enregistré";
    state.currentAssignment.mozaikSyncStatus = "dirty";
    await refreshSyncState();
    setTimeout(() => input.classList.remove("saved"), 700);
  } catch (e) {
    s.grade = old;
    input.value = old === null ? "" : formatNumber(old, 3);
    input.classList.remove("saving");
    input.classList.add("error");
    updatePercent(input, old);
    $("gradeSaveState").textContent = e.message;
  }
}

function openStudentDialog(email) {
  const s = state.currentStudents.find(x => x.email === email);
  if (!s) return;
  state.currentStudent = s;
  $("dialogStudentMeta").textContent = `Groupe ${s.group} · ${s.email}`;
  $("dialogStudentName").textContent = s.name;
  $("dialogResponse").textContent = s.response || "Aucune réponse enregistrée.";
  $("dialogFeedback").value = s.feedback || "";
  $("resultDialog").showModal();
}
$("closeResultDialog").onclick = () => $("resultDialog").close();
$("saveFeedbackBtn").onclick = async () => {
  const s = state.currentStudent;
  if (!s) return;
  try {
    const feedback = $("dialogFeedback").value;
    await api(TEACHER_ENDPOINT, {
      action: "saveResult",
      token: state.teacherToken,
      assignmentId: state.currentAssignment.id,
      email: s.email,
      response: s.response,
      grade: s.grade,
      feedback,
      visible: true,
    });
    s.feedback = feedback;
    $("resultDialog").close();
    notify("Rétroaction enregistrée.");
  } catch (e) {
    notify(e.message, "error");
  }
};

async function refreshSyncState() {
  if (!state.currentAssignment?.id) return;
  try {
    const d = await api(SYNC_ENDPOINT, { action: "status", teacherToken: state.teacherToken, assignmentId: state.currentAssignment.id });
    state.syncLinks = d.links || [];
    const link = state.syncLinks.find(x => x.group_code === state.detailGroup);
    const btn = $("syncMozaikBtn");
    if (!link) {
      $("syncState").textContent = "Pas encore synchronisé avec Mozaïk.";
      btn.textContent = "Envoyer dans Mozaïk";
      return;
    }
    if (link.sync_status === "synced") {
      $("syncState").textContent = `Synchronisé${link.last_result_count != null ? ` · ${link.last_result_count} note${Number(link.last_result_count) === 1 ? "" : "s"}` : ""}`;
      btn.textContent = "Mettre à jour Mozaïk";
    } else if (link.sync_status === "dirty") {
      $("syncState").textContent = "Modifications non synchronisées.";
      btn.textContent = "Mettre à jour Mozaïk";
    } else if (link.sync_status === "error") {
      $("syncState").textContent = link.last_error ? `Dernière erreur : ${link.last_error}` : "La dernière synchronisation a échoué.";
      btn.textContent = "Réessayer la synchro";
    } else {
      $("syncState").textContent = "Synchronisation en attente.";
      btn.textContent = "Envoyer dans Mozaïk";
    }
  } catch (e) {
    $("syncState").textContent = e.message;
  }
}

function validateMozaikGrades() {
  const rows = state.currentStudents.filter(s => s.group === state.detailGroup && s.grade !== null && s.grade !== undefined);
  const tooPrecise = rows.filter(s => decimalPlaces(Number(s.grade)) > 1);
  if (tooPrecise.length) {
    throw new Error(`${tooPrecise.length} note${tooPrecise.length === 1 ? " comporte" : "s comportent"} plus d’une décimale. Corrige-les avant la synchro Mozaïk.`);
  }
}

$("syncMozaikBtn").onclick = async () => {
  if (!state.currentAssignment?.id) return;
  const btn = $("syncMozaikBtn");
  let job = null;
  let completed = false;
  try {
    btn.disabled = true;
    btn.textContent = "Préparation...";
    $("syncState").textContent = "Préparation de la synchronisation...";
    pingExtension();
    await new Promise(r => setTimeout(r, 220));
    if (!state.extensionReady) throw new Error("Extension Chrome non détectée. Recharge l’extension puis cette page.");

    await saveAssignmentSettings({ quiet: true });
    const group = state.detailGroup;
    if (!group) throw new Error("Choisis un groupe.");
    validateMozaikGrades();

    await api(SYNC_ENDPOINT, {
      action: "prepare",
      teacherToken: state.teacherToken,
      assignmentId: state.currentAssignment.id,
      groupCode: group,
      settings: {
        term: Number(state.currentAssignment.term || 1),
        activityDate: state.currentAssignment.activityDate || today(),
        period: Number(state.currentAssignment.period || 3),
        weight: state.currentAssignment.weight ?? 0,
        competenceKind: state.currentAssignment.competenceKind,
        reportCardEnabled: !!state.currentAssignment.reportCardEnabled,
        resultsVisible: !!state.currentAssignment.resultsVisible,
        showInSchedule: state.currentAssignment.showInSchedule !== false,
        homework: !!state.currentAssignment.homework,
      },
    });
    job = await api(SYNC_ENDPOINT, { action: "claimLatest", teacherToken: state.teacherToken });

    btn.textContent = "Connexion à Mozaïk...";
    $("syncState").textContent = "Mozaïk s’ouvre automatiquement. Connecte-toi au besoin, la synchronisation continuera toute seule.";
    const result = await sendToExtension(job.payload);

    let completeResponse;
    try {
      completeResponse = await api(SYNC_ENDPOINT, {
        action: "complete",
        jobId: job.jobId,
        claimToken: job.claimToken,
        success: result?.success === true,
        activityId: result?.activityId || "",
        competenceCode: result?.competenceCode || "",
        syncedCount: result?.syncedCount || 0,
        message: result?.message || "",
      });
      completed = true;
    } catch (completeError) {
      if (result?.success) {
        throw new Error(`Mozaïk a reçu les notes, mais la plateforme n’a pas pu enregistrer la confirmation. Vérifie Mozaïk avant de réessayer. ${completeError.message}`);
      }
      throw completeError;
    }

    if (!result?.success) throw new Error(result?.message || completeResponse?.message || "La synchronisation a échoué.");

    const label = result.competenceLabel || competenceLabel(state.currentAssignment.competenceKind);
    $("syncState").textContent = `Synchronisation réussie : ${result.syncedCount} note${result.syncedCount === 1 ? "" : "s"} envoyée${result.syncedCount === 1 ? "" : "s"} · ${label}.`;
    notify(`Synchronisation réussie : ${result.syncedCount} note${result.syncedCount === 1 ? "" : "s"} envoyée${result.syncedCount === 1 ? "" : "s"} dans Mozaïk.`);
    await refreshSyncState();
  } catch (e) {
    if (job && !completed) {
      try {
        await api(SYNC_ENDPOINT, {
          action: "complete",
          jobId: job.jobId,
          claimToken: job.claimToken,
          success: false,
          activityId: "",
          competenceCode: "",
          syncedCount: 0,
          message: e.message,
        });
      } catch {}
    }
    $("syncState").textContent = e.message;
    notify(e.message, "error");
  } finally {
    btn.disabled = false;
    await refreshSyncState();
  }
};

(async function restore() {
  show(loginView, false);
  show(studentView, false);
  show(teacherView, false);
  show(bootView, true);
  if (state.teacherToken) {
    try {
      await loadTeacherDashboard();
      return;
    } catch {
      localStorage.removeItem("results_teacher_token");
      state.teacherToken = "";
    }
  }
  if (state.studentToken) {
    try {
      await loadStudentDashboard();
      return;
    } catch {
      sessionStorage.removeItem("results_student_token");
      state.studentToken = "";
    }
  }
  show(bootView, false);
  show(loginView, true);
  show(logoutBtn, false);
})();
