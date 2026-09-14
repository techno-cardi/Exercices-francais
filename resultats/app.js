const DATA_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-results";
const AUTH_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-student-auth";
const TEACHER_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-teacher-api";
const PUBLIC_KEY = "sb_publishable_mI94i3exzVPlHveGFX1WOw_1Ucab3_f";

const $ = (id) => document.getElementById(id);
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
};

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
authExtra.className = "auth-extra";
credentialBlock.appendChild(authExtra);

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

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}
function clearError() {
  loginError.textContent = "";
  loginError.classList.add("hidden");
}
function setLoading(on, label = "Chargement...") {
  loginBtn.disabled = on;
  loginBtn.textContent = on ? label : buttonLabel();
}
function buttonLabel() {
  if (state.loginMode === "email") return "Continuer";
  if (state.loginMode === "activate") return "Activer mon compte";
  if (state.loginMode === "reset") return "Choisir ce nouveau mot de passe";
  return "Se connecter";
}
function resetCredentialUi() {
  credentialBlock.classList.add("hidden");
  credentialInput.value = "";
  credentialInput.type = "password";
  credentialInput.autocomplete = "off";
  credentialInput.inputMode = "";
  authExtra.innerHTML = "";
  credentialHint.textContent = "";
}
function addPasswordFields(reset = false) {
  authExtra.innerHTML = `
    <div class="password-grid">
      <div>
        <label class="field-label" for="newPassword">${reset ? "Nouveau mot de passe" : "Crée un mot de passe"}</label>
        <input id="newPassword" class="text-input" type="password" autocomplete="new-password" minlength="8">
      </div>
      <div>
        <label class="field-label" for="confirmPassword">Confirme le mot de passe</label>
        <input id="confirmPassword" class="text-input" type="password" autocomplete="new-password" minlength="8">
      </div>
    </div>
    <div class="field-hint">Minimum 8 caractères. Après l’activation, tu utiliseras seulement ton courriel et ce mot de passe.</div>`;
}
function configureMode(mode) {
  state.loginMode = mode;
  credentialBlock.classList.remove("hidden");
  authExtra.innerHTML = "";
  credentialInput.value = "";

  if (mode === "teacher") {
    credentialLabel.textContent = "Mot de passe enseignant";
    credentialInput.type = "password";
    credentialInput.autocomplete = "current-password";
    credentialInput.inputMode = "";
    credentialHint.textContent = "Utilise le mot de passe enseignant de cette plateforme.";
  } else if (mode === "password") {
    credentialLabel.textContent = "Mot de passe";
    credentialInput.type = "password";
    credentialInput.autocomplete = "current-password";
    credentialInput.inputMode = "";
    credentialHint.textContent = "Ton compte est déjà activé.";
    authExtra.innerHTML = `<button id="forgotBtn" class="link-btn" type="button">Mot de passe oublié?</button>`;
    $("forgotBtn").addEventListener("click", () => configureMode("reset"));
  } else if (mode === "activate") {
    credentialLabel.textContent = "Numéro de fiche";
    credentialInput.type = "password";
    credentialInput.inputMode = "numeric";
    credentialInput.autocomplete = "off";
    credentialHint.textContent = "Première connexion : entre ton numéro de fiche, puis choisis ton mot de passe.";
    addPasswordFields(false);
  } else if (mode === "reset") {
    credentialLabel.textContent = "Numéro de fiche";
    credentialInput.type = "password";
    credentialInput.inputMode = "numeric";
    credentialInput.autocomplete = "off";
    credentialHint.textContent = "Ton numéro de fiche permet de confirmer ton identité avant de choisir un nouveau mot de passe.";
    addPasswordFields(true);
  }
  loginBtn.textContent = buttonLabel();
  credentialInput.focus();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  try {
    if (state.loginMode === "email") {
      const email = emailInput.value.trim().toLowerCase();
      if (!email.includes("@")) throw new Error("Entre ton adresse courriel complète.");
      state.email = email;
      setLoading(true, "Vérification...");
      if (email.endsWith("@educ.cscapitale.qc.ca")) {
        const data = await api(AUTH_ENDPOINT, { action: "mode", email });
        configureMode(data.mode);
      } else {
        configureMode("teacher");
      }
      return;
    }

    if (state.loginMode === "teacher") {
      setLoading(true, "Connexion...");
      const data = await api(TEACHER_ENDPOINT, { action: "login", email: state.email, password: credentialInput.value });
      state.teacherToken = data.token;
      localStorage.setItem("results_teacher_token", data.token);
      await loadTeacherDashboard();
      return;
    }

    if (state.loginMode === "password") {
      setLoading(true, "Connexion...");
      const data = await api(AUTH_ENDPOINT, { action: "login", email: state.email, password: credentialInput.value });
      state.studentToken = data.token;
      sessionStorage.setItem("results_student_token", data.token);
      await loadStudentDashboard();
      return;
    }

    if (state.loginMode === "activate" || state.loginMode === "reset") {
      const password = $("newPassword")?.value || "";
      const confirm = $("confirmPassword")?.value || "";
      if (password.length < 8) throw new Error("Choisis un mot de passe d’au moins 8 caractères.");
      if (password !== confirm) throw new Error("Les deux mots de passe ne sont pas identiques.");
      setLoading(true, state.loginMode === "activate" ? "Activation..." : "Modification...");
      const data = await api(AUTH_ENDPOINT, {
        action: state.loginMode === "activate" ? "activate" : "reset",
        email: state.email,
        fiche: credentialInput.value.trim(),
        password,
      });
      state.studentToken = data.token;
      sessionStorage.setItem("results_student_token", data.token);
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
  const oldTeacherToken = state.teacherToken;
  localStorage.removeItem("results_teacher_token");
  sessionStorage.removeItem("results_student_token");
  state.teacherToken = "";
  state.studentToken = "";
  state.loginMode = "email";
  state.email = "";
  emailInput.value = "";
  resetCredentialUi();
  studentView.classList.add("hidden");
  teacherView.classList.add("hidden");
  loginView.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  loginBtn.textContent = "Continuer";
  if (oldTeacherToken) {
    try { await api(TEACHER_ENDPOINT, { action: "logout", token: oldTeacherToken }); } catch {}
  }
});

async function loadStudentDashboard() {
  const data = await api(DATA_ENDPOINT, { action: "studentDashboard", token: state.studentToken });
  loginView.classList.add("hidden");
  teacherView.classList.add("hidden");
  studentView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  $("studentName").textContent = data.user.name;
  $("studentMeta").textContent = `${data.user.email} · Groupe ${data.user.group}`;
  const graded = data.assignments.filter(a => a.result && a.result.grade !== null);
  $("studentSummary").innerHTML = `<strong>${graded.length}</strong><span>résultat${graded.length === 1 ? "" : "s"} disponible${graded.length === 1 ? "" : "s"}</span>`;
  const root = $("studentAssignments");
  if (!data.assignments.length) {
    root.innerHTML = `<div class="panel empty-state">Aucun travail publié pour le moment.</div>`;
    return;
  }
  root.innerHTML = data.assignments.map(a => {
    const tags = [...(a.competencies || []).map(c => `<span class="tag">${escapeHtml(c)}</span>`), a.weight !== null ? `<span class="tag">Pondération ${a.weight}%</span>` : ""].join("");
    if (!a.result) {
      return `<article class="panel student-card"><div class="student-card-head"><div><div class="eyebrow">Travail</div><h2>${escapeHtml(a.title)}</h2></div><div class="score-badge">À venir</div></div><div class="metadata">${tags}</div>${a.instructions ? `<div class="instructions">${escapeHtml(a.instructions)}</div>` : ""}<p class="muted">Aucun résultat publié pour ce travail.</p></article>`;
    }
    const score = a.result.grade === null ? "Non noté" : `${formatNumber(a.result.grade)} / ${formatNumber(a.maxScore)}`;
    return `<article class="panel student-card"><div class="student-card-head"><div><div class="eyebrow">Travail corrigé</div><h2>${escapeHtml(a.title)}</h2></div><div class="score-badge">${score}</div></div><div class="metadata">${tags}</div>${a.instructions ? `<div class="instructions">${escapeHtml(a.instructions)}</div>` : ""}<div class="student-detail-grid"><div class="detail-box"><h3>Ta réponse</h3><div class="response-text">${escapeHtml(a.result.response || "Aucune réponse enregistrée.")}</div></div><div class="detail-box"><h3>Rétroaction</h3><div class="feedback-text">${escapeHtml(a.result.feedback || "Aucune rétroaction pour le moment.")}</div></div></div></article>`;
  }).join("");
}

async function loadTeacherDashboard() {
  const data = await api(TEACHER_ENDPOINT, { action: "teacherDashboard", token: state.teacherToken });
  state.teacherAssignments = data.assignments || [];
  state.groupStats = data.groups || {};
  loginView.classList.add("hidden");
  studentView.classList.add("hidden");
  teacherView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  $("assignmentDetail").classList.add("hidden");
  $("assignmentList").classList.remove("hidden");
  $("groupStats").innerHTML = ["31","32","51"].map(g => `<div class="panel stat-card"><div class="eyebrow">Groupe ${g}</div><div class="stat-number">${state.groupStats[g] || 0}</div><div class="muted">élèves</div></div>`).join("");
  renderAssignmentList();
}

function renderAssignmentList() {
  const search = $("assignmentSearch").value.trim().toLowerCase();
  const group = $("assignmentGroupFilter").value;
  const sort = $("assignmentSort").value;
  let list = state.teacherAssignments.filter(a => (!search || a.title.toLowerCase().includes(search)) && (!group || a.groups.includes(group)));
  if (sort === "title") list.sort((a,b) => a.title.localeCompare(b.title,"fr"));
  if (sort === "average") list.sort((a,b) => (b.average ?? -1) - (a.average ?? -1));
  if (sort === "progress") list.sort((a,b) => (b.gradedCount/b.studentCount || 0) - (a.gradedCount/a.studentCount || 0));
  const root = $("assignmentList");
  if (!list.length) { root.innerHTML = `<div class="panel empty-state">Aucun travail ne correspond aux filtres.</div>`; return; }
  root.innerHTML = list.map(a => `<article class="panel assignment-card" data-id="${a.id}"><div><h3 class="assignment-title editable" data-title-id="${a.id}" title="Double-clique pour renommer">${escapeHtml(a.title)}</h3><div class="assignment-meta"><span><span class="status-dot ${a.published ? "live" : ""}"></span>${a.published ? "Publié" : "Masqué"}</span><span>Groupes ${a.groups.join(", ")}</span>${a.competencies.length ? `<span>${a.competencies.map(escapeHtml).join(" · ")}</span>` : ""}${a.weight !== null ? `<span>${a.weight}%</span>` : ""}</div></div><div class="assignment-metrics"><div class="metric"><strong>${a.average === null ? "-" : formatNumber(a.average)}</strong><span class="muted">moyenne</span></div><div class="metric"><strong>${a.gradedCount}/${a.studentCount}</strong><span class="muted">corrigés</span></div><button class="ghost-btn open-assignment" type="button">Ouvrir</button></div></article>`).join("");

  root.querySelectorAll(".open-assignment").forEach(btn => btn.addEventListener("click", e => openAssignment(e.target.closest(".assignment-card").dataset.id)));
  root.querySelectorAll(".assignment-title").forEach(title => {
    title.addEventListener("dblclick", async (event) => {
      event.stopPropagation();
      const id = title.dataset.titleId;
      const assignment = state.teacherAssignments.find(a => a.id === id);
      if (!assignment) return;
      title.contentEditable = "true";
      title.focus();
      document.execCommand?.("selectAll", false, null);
      const finish = async () => {
        title.contentEditable = "false";
        const newTitle = title.textContent.trim();
        if (!newTitle || newTitle === assignment.title) { title.textContent = assignment.title; return; }
        try {
          await api(TEACHER_ENDPOINT, { action: "saveAssignment", token: state.teacherToken, assignment: { ...assignment, title: newTitle } });
          assignment.title = newTitle;
          renderAssignmentList();
        } catch (err) { alert(err.message); title.textContent = assignment.title; }
      };
      title.addEventListener("blur", finish, { once:true });
      title.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); title.blur(); } if (e.key === "Escape") { title.textContent = assignment.title; title.blur(); } }, { once:true });
    });
  });
}

["assignmentSearch","assignmentGroupFilter","assignmentSort"].forEach(id => $(id).addEventListener("input", renderAssignmentList));

$("newAssignmentBtn").addEventListener("click", () => {
  state.currentAssignment = { id:null,title:"Nouveau travail",competencies:[],weight:null,maxScore:10,groups:["51"],published:false,instructions:"" };
  state.currentStudents = [];
  fillAssignmentEditor();
  $("assignmentList").classList.add("hidden");
  $("assignmentDetail").classList.remove("hidden");
  $("studentRows").innerHTML = `<tr><td colspan="5" class="empty-state">Enregistre d’abord le travail pour afficher les élèves.</td></tr>`;
});

$("backToAssignments").addEventListener("click", () => {
  $("assignmentDetail").classList.add("hidden");
  $("assignmentList").classList.remove("hidden");
});

async function openAssignment(id) {
  const data = await api(TEACHER_ENDPOINT, { action: "teacherAssignment", token: state.teacherToken, assignmentId:id });
  state.currentAssignment = data.assignment;
  state.currentStudents = data.students || [];
  fillAssignmentEditor();
  $("assignmentList").classList.add("hidden");
  $("assignmentDetail").classList.remove("hidden");
  renderStudentRows();
}

function fillAssignmentEditor() {
  const a = state.currentAssignment;
  $("editTitle").value = a.title || "";
  $("editWeight").value = a.weight ?? "";
  $("editMaxScore").value = a.maxScore ?? 10;
  $("editInstructions").value = a.instructions || "";
  $("editPublished").checked = !!a.published;
  document.querySelectorAll("#competencyChoices input").forEach(input => input.checked = (a.competencies || []).includes(input.value));
  document.querySelectorAll("#groupChoices input").forEach(input => input.checked = (a.groups || []).includes(input.value));
}

function collectAssignment() {
  return {
    id: state.currentAssignment?.id || null,
    title: $("editTitle").value.trim(),
    weight: $("editWeight").value === "" ? null : Number($("editWeight").value),
    maxScore: Number($("editMaxScore").value || 10),
    competencies: [...document.querySelectorAll("#competencyChoices input:checked")].map(i => i.value),
    groups: [...document.querySelectorAll("#groupChoices input:checked")].map(i => i.value),
    published: $("editPublished").checked,
    instructions: $("editInstructions").value,
  };
}

$("saveAssignmentBtn").addEventListener("click", async () => {
  try {
    $("saveState").textContent = "Enregistrement...";
    const assignment = collectAssignment();
    const data = await api(TEACHER_ENDPOINT, { action:"saveAssignment", token:state.teacherToken, assignment });
    $("saveState").textContent = "Enregistré";
    await loadTeacherDashboard();
    await openAssignment(data.id);
  } catch (err) { $("saveState").textContent = ""; alert(err.message); }
});

function renderStudentRows() {
  const search = $("studentSearch").value.trim().toLowerCase();
  const group = $("studentGroupFilter").value;
  const sort = $("studentSort").value;
  let list = state.currentStudents.filter(s => (!search || s.name.toLowerCase().includes(search) || s.email.toLowerCase().includes(search)) && (!group || s.group === group));
  if (sort === "name") list.sort((a,b) => a.name.localeCompare(b.name,"fr"));
  if (sort === "gradeDesc") list.sort((a,b) => (b.grade ?? -Infinity) - (a.grade ?? -Infinity));
  if (sort === "gradeAsc") list.sort((a,b) => (a.grade ?? Infinity) - (b.grade ?? Infinity));
  if (sort === "ungraded") list.sort((a,b) => Number(a.grade !== null) - Number(b.grade !== null) || a.name.localeCompare(b.name,"fr"));
  $("studentRows").innerHTML = list.map(s => `<tr><td><strong>${escapeHtml(s.name)}</strong><br><span class="muted">${escapeHtml(s.email)}</span></td><td>${s.group}</td><td class="grade-cell">${s.grade === null ? "-" : `${formatNumber(s.grade)} / ${formatNumber(state.currentAssignment.maxScore)}`}</td><td>${s.visible ? "Visible" : "Masqué"}</td><td><button class="ghost-btn open-copy" data-email="${escapeAttr(s.email)}" type="button">Corriger</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty-state">Aucun élève.</td></tr>`;
  document.querySelectorAll(".open-copy").forEach(btn => btn.addEventListener("click", () => openStudentDialog(btn.dataset.email)));
}
["studentSearch","studentGroupFilter","studentSort"].forEach(id => $(id).addEventListener("input", renderStudentRows));

function openStudentDialog(email) {
  const s = state.currentStudents.find(x => x.email === email);
  if (!s) return;
  state.currentStudent = s;
  $("dialogStudentMeta").textContent = `Groupe ${s.group} · ${s.email}`;
  $("dialogStudentName").textContent = s.name;
  $("dialogResponse").textContent = s.response || "Aucune réponse enregistrée.";
  $("dialogGrade").value = s.grade ?? "";
  $("dialogGrade").max = state.currentAssignment.maxScore;
  $("dialogMaxScore").textContent = `/ ${formatNumber(state.currentAssignment.maxScore)}`;
  $("dialogFeedback").value = s.feedback || "";
  $("dialogVisible").checked = s.visible !== false;
  $("resultDialog").showModal();
}

$("saveResultBtn").addEventListener("click", async () => {
  if (!state.currentStudent) return;
  const btn = $("saveResultBtn");
  btn.disabled = true;
  btn.textContent = "Enregistrement...";
  try {
    const grade = $("dialogGrade").value === "" ? null : Number($("dialogGrade").value);
    await api(TEACHER_ENDPOINT, {
      action:"saveResult",
      token:state.teacherToken,
      assignmentId:state.currentAssignment.id,
      email:state.currentStudent.email,
      response:state.currentStudent.response,
      grade,
      feedback:$("dialogFeedback").value,
      visible:$("dialogVisible").checked,
    });
    state.currentStudent.grade = grade;
    state.currentStudent.feedback = $("dialogFeedback").value;
    state.currentStudent.visible = $("dialogVisible").checked;
    $("resultDialog").close();
    renderStudentRows();
    $("saveState").textContent = "Correction enregistrée";
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = "Enregistrer"; }
});

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function escapeAttr(value) { return escapeHtml(value); }
function formatNumber(value) { const n = Number(value); return Number.isInteger(n) ? String(n) : n.toLocaleString("fr-CA", { maximumFractionDigits:1 }); }

(async function restoreSession(){
  if (state.teacherToken) {
    try { await loadTeacherDashboard(); return; } catch { localStorage.removeItem("results_teacher_token"); state.teacherToken=""; }
  }
  if (state.studentToken) {
    try { await loadStudentDashboard(); return; } catch { sessionStorage.removeItem("results_student_token"); state.studentToken=""; }
  }
})();
