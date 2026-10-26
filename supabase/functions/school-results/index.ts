import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const ALLOWED_ORIGIN = "https://techno-cardi.github.io";
const ATELIER_URL = "https://script.google.com/macros/s/AKfycbzfWoKG4vrwahyRCkjmctNUhR7N598-XpmGyvMWuduRzCsiOyvcBvuGlyLgqe18k6fj/exec";
const encoder = new TextEncoder();

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function response(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function fail(message: string, status = 400): never {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  throw error;
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function b64urlDecode(value: string) {
  let s = value.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const raw = atob(s);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function b64urlEncode(bytes: Uint8Array) {
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyFiche(input: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10000) return false;
  const salt = b64urlDecode(parts[2]);
  const expected = b64urlDecode(parts[3]);
  const key = await crypto.subtle.importKey("raw", encoder.encode(input), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, expected.length * 8);
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) fail("Service temporairement indisponible.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function requirePublishableKey(req: Request) {
  const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const expected = keys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supplied = req.headers.get("apikey") || "";
  if (!expected || supplied !== expected) fail("Accès refusé.", 401);
}

async function callAtelier(body: Record<string, unknown>) {
  const res = await fetch(ATELIER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try { data = await res.json(); } catch { fail("Le service enseignant ne répond pas.", 503); }
  return data;
}

async function validateTeacher(token: string) {
  if (!token) fail("Session enseignant expirée.", 401);
  const check = await callAtelier({ action: "dashboard", token });
  if (!check?.ok) fail("Session enseignant expirée.", 401);
}

async function recordFailedLogin(db: any, email: string) {
  const now = Date.now();
  const { data } = await db.from("school_login_attempts").select("failed_count,window_started_at,locked_until").eq("email", email).maybeSingle();
  let failed = 1;
  let windowStarted = new Date(now).toISOString();
  if (data) {
    const started = new Date(data.window_started_at).getTime();
    if (Number.isFinite(started) && now - started < 15 * 60 * 1000) {
      failed = Number(data.failed_count || 0) + 1;
      windowStarted = data.window_started_at;
    }
  }
  const lockedUntil = failed >= 5 ? new Date(now + 15 * 60 * 1000).toISOString() : null;
  await db.from("school_login_attempts").upsert({ email, failed_count: failed, window_started_at: windowStarted, locked_until: lockedUntil, updated_at: new Date().toISOString() });
}

async function checkLoginLock(db: any, email: string) {
  const { data } = await db.from("school_login_attempts").select("locked_until").eq("email", email).maybeSingle();
  if (data?.locked_until && new Date(data.locked_until).getTime() > Date.now()) {
    fail("Trop de tentatives. Réessaie dans quelques minutes.", 429);
  }
}

async function studentFromToken(db: any, token: string) {
  if (!token) fail("Ta session est expirée. Reconnecte-toi.", 401);
  const tokenHash = await sha256Hex(token);
  const { data: session } = await db.from("school_student_sessions").select("student_email,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) fail("Ta session est expirée. Reconnecte-toi.", 401);
  const { data: student } = await db.from("school_students").select("email,name,group_code,active").eq("email", session.student_email).maybeSingle();
  if (!student?.active) fail("Ton accès n’est plus actif.", 403);
  return student;
}

async function actionStudentLogin(db: any, body: any) {
  const email = normalizeEmail(body.email);
  const fiche = String(body.fiche || "").trim();
  if (!/^[^\s@]+@educ\.cscapitale\.qc\.ca$/.test(email) || !/^\d{7}$/.test(fiche)) {
    fail("Courriel ou numéro de fiche invalide.", 401);
  }
  await checkLoginLock(db, email);
  const { data: student } = await db.from("school_students").select("email,name,group_code,fiche_hash,active").eq("email", email).maybeSingle();
  const valid = !!student?.active && await verifyFiche(fiche, student.fiche_hash || "");
  if (!valid) {
    await recordFailedLogin(db, email);
    fail("Courriel ou numéro de fiche invalide.", 401);
  }
  await db.from("school_login_attempts").delete().eq("email", email);
  await db.from("school_student_sessions").delete().lt("expires_at", new Date().toISOString());
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = b64urlEncode(tokenBytes);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await db.from("school_student_sessions").insert({ token_hash: tokenHash, student_email: email, expires_at: expiresAt });
  return { token, user: { email: student.email, name: student.name, group: student.group_code }, expiresAt };
}

async function actionStudentDashboard(db:any,body:any){
 const student=await studentFromToken(db,String(body.token||''));
 const {data,error}=await db.rpc('cardinal_student_year_results',{p_email:student.email});
 if(error)fail('Impossible de charger tes travaux.',500);
 return{user:{email:student.email,name:student.name,group:student.group_code},assignments:data||[]};
}

async function actionTeacherLogin(body: any) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) fail("Entre ton courriel et ton mot de passe.", 400);
  const first = await callAtelier({ action: "loginWithEmail", email });
  if (!first?.ok || !first?.needsPassword) fail("Le courriel ou le mot de passe est incorrect.", 401);
  const second = await callAtelier({ action: "verifyTeacherPassword", email, password, setupCode: String(body.setupCode || "") });
  if (!second?.ok || second?.user?.role !== "enseignant" || !second?.token) fail("Le courriel ou le mot de passe est incorrect.", 401);
  return { token: second.token, user: second.user };
}

async function actionTeacherDashboard(db: any, body: any) {
  await validateTeacher(String(body.token || ""));
  const [{ data: assignments, error: aErr }, { data: students, error: sErr }, { data: results, error: rErr }] = await Promise.all([
    db.from("school_assignments").select("id,title,competencies,weight,max_score,group_codes,published,instructions,created_at,updated_at").order("created_at", { ascending: false }),
    db.from("school_students").select("email,group_code").eq("active", true),
    db.from("school_results").select("assignment_id,grade,visible"),
  ]);
  if (aErr || sErr || rErr) fail("Impossible de charger le tableau de bord.", 500);
  const allStudents = students || [];
  const allResults = results || [];
  const list = (assignments || []).map((a: any) => {
    const eligible = allStudents.filter((s: any) => (a.group_codes || []).includes(s.group_code));
    const rows = allResults.filter((r: any) => r.assignment_id === a.id);
    const graded = rows.filter((r: any) => r.grade !== null && r.grade !== undefined);
    const average = graded.length ? Math.round((graded.reduce((sum: number, r: any) => sum + Number(r.grade), 0) / graded.length) * 10) / 10 : null;
    return {
      id: a.id,
      title: a.title,
      competencies: a.competencies || [],
      weight: a.weight === null ? null : Number(a.weight),
      maxScore: a.max_score === null ? null : Number(a.max_score),
      groups: a.group_codes || [],
      published: !!a.published,
      instructions: a.instructions || "",
      studentCount: eligible.length,
      resultCount: rows.length,
      gradedCount: graded.length,
      average,
      updatedAt: a.updated_at,
    };
  });
  return { assignments: list, groups: { "31": allStudents.filter((s: any) => s.group_code === "31").length, "32": allStudents.filter((s: any) => s.group_code === "32").length, "51": allStudents.filter((s: any) => s.group_code === "51").length } };
}

async function actionTeacherAssignment(db: any, body: any) {
  await validateTeacher(String(body.token || ""));
  const id = String(body.assignmentId || "");
  const { data: assignment } = await db.from("school_assignments").select("id,title,competencies,weight,max_score,group_codes,published,instructions,created_at,updated_at").eq("id", id).maybeSingle();
  if (!assignment) fail("Travail introuvable.", 404);
  const [{ data: students }, { data: results }] = await Promise.all([
    db.from("school_students").select("email,name,group_code").eq("active", true).in("group_code", assignment.group_codes || []),
    db.from("school_results").select("student_email,response,grade,feedback,visible,updated_at").eq("assignment_id", id),
  ]);
  const map = new Map((results || []).map((r: any) => [r.student_email, r]));
  const rows = (students || []).map((s: any) => {
    const r = map.get(s.email);
    return {
      email: s.email,
      name: s.name,
      group: s.group_code,
      response: r?.response || "",
      grade: r?.grade === null || r?.grade === undefined ? null : Number(r.grade),
      feedback: r?.feedback || "",
      visible: r ? !!r.visible : true,
      updatedAt: r?.updated_at || null,
    };
  }).sort((a: any, b: any) => a.group.localeCompare(b.group, "fr") || a.name.localeCompare(b.name, "fr"));
  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      competencies: assignment.competencies || [],
      weight: assignment.weight === null ? null : Number(assignment.weight),
      maxScore: assignment.max_score === null ? null : Number(assignment.max_score),
      groups: assignment.group_codes || [],
      published: !!assignment.published,
      instructions: assignment.instructions || "",
    },
    students: rows,
  };
}

function cleanAssignment(input: any) {
  const title = String(input?.title || "").trim();
  if (!title || title.length > 140) fail("Le titre du travail est invalide.", 400);
  const groups = [...new Set((input?.groups || []).map((g: any) => String(g)).filter((g: string) => ["31","32","51"].includes(g)))];
  if (!groups.length) fail("Choisis au moins un groupe.", 400);
  const competencies = [...new Set((input?.competencies || []).map((c: any) => String(c).trim()).filter(Boolean))].slice(0, 8);
  const maxScore = Number(input?.maxScore ?? 10);
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) fail("Le total du travail est invalide.", 400);
  const weightRaw = input?.weight;
  const weight = weightRaw === null || weightRaw === "" || weightRaw === undefined ? null : Number(weightRaw);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100)) fail("La pondération doit être entre 0 et 100.", 400);
  const instructions = String(input?.instructions || "").trim().slice(0, 8000);
  return { title, group_codes: groups, competencies, max_score: maxScore, weight, instructions, published: !!input?.published, updated_at: new Date().toISOString() };
}

async function actionSaveAssignment(db: any, body: any) {
  await validateTeacher(String(body.token || ""));
  const input = body.assignment || {};
  const payload = cleanAssignment(input);
  if (input.id) {
    const { data, error } = await db.from("school_assignments").update(payload).eq("id", String(input.id)).select("id").maybeSingle();
    if (error || !data) fail("Impossible d’enregistrer le travail.", 500);
    return { id: data.id };
  }
  const { data, error } = await db.from("school_assignments").insert({ ...payload, slug: null }).select("id").single();
  if (error || !data) fail("Impossible de créer le travail.", 500);
  return { id: data.id };
}

async function actionSaveResult(db: any, body: any) {
  await validateTeacher(String(body.token || ""));
  const assignmentId = String(body.assignmentId || "");
  const email = normalizeEmail(body.email);
  const [{ data: assignment }, { data: student }] = await Promise.all([
    db.from("school_assignments").select("id,max_score,group_codes").eq("id", assignmentId).maybeSingle(),
    db.from("school_students").select("email,group_code,active").eq("email", email).maybeSingle(),
  ]);
  if (!assignment || !student?.active || !(assignment.group_codes || []).includes(student.group_code)) fail("Élève ou travail invalide.", 400);
  const rawGrade = body.grade;
  const grade = rawGrade === null || rawGrade === "" || rawGrade === undefined ? null : Number(rawGrade);
  if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > Number(assignment.max_score))) fail("La note est invalide.", 400);
  const feedback = String(body.feedback || "").slice(0, 12000);
  const responseText = String(body.response || "").slice(0, 60000);
  const visible = body.visible !== false;
  const { error } = await db.from("school_results").upsert({ assignment_id: assignmentId, student_email: email, response: responseText, grade, feedback, visible, updated_at: new Date().toISOString() }, { onConflict: "assignment_id,student_email" });
  if (error) fail("Impossible d’enregistrer la correction.", 500);
  return { saved: true };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  try {
    if (req.method !== "POST") fail("Méthode non permise.", 405);
    if (origin && origin !== ALLOWED_ORIGIN) fail("Origine non autorisée.", 403);
    requirePublishableKey(req);
    let body: any = {};
    try { body = await req.json(); } catch { fail("Requête invalide.", 400); }
    const action = String(body.action || "");
    const db = adminClient();
    let data: any;
    switch (action) {
      case "studentLogin": data = await actionStudentLogin(db, body); break;
      case "studentDashboard": data = await actionStudentDashboard(db, body); break;
      case "teacherLogin": data = await actionTeacherLogin(body); break;
      case "teacherDashboard": fail("Actualise Gestion pour consulter les résultats par année scolaire.",409);
      case "teacherAssignment": fail("Actualise Gestion pour consulter les listes historiques.",409);
      case "saveAssignment":
      case "saveResult": fail("Actualise Gestion des notes pour utiliser l’enregistrement vérifié des travaux et des notes.", 409);
      default: fail("Demande inconnue.", 400);
    }
    return response({ ok: true, ...data }, 200, origin);
  } catch (error) {
    const err = error as Error & { status?: number };
    console.error(err.message);
    return response({ ok: false, message: err.message || "Une erreur est survenue." }, err.status || 500, origin);
  }
});
