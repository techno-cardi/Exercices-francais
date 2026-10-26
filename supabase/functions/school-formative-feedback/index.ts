import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const ALLOWED_ORIGIN = "https://techno-cardi.github.io";
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

function json(body: unknown, status = 200, origin: string | null = null) {
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

function admin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key = keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) fail("Service temporairement indisponible.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function requireKey(req: Request) {
  const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const expected = keys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!expected || req.headers.get("apikey") !== expected) fail("Accès refusé.", 401);
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function teacherFromToken(db: any, token: string) {
  if (!token) fail("Session enseignant expirée.", 401);
  const hash = await sha256Hex(token);
  const { data: session } = await db.from("school_teacher_sessions")
    .select("teacher_email,expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) fail("Session enseignant expirée.", 401);
  const { data: teacher } = await db.from("school_teachers")
    .select("email,active")
    .eq("email", session.teacher_email)
    .maybeSingle();
  if (!teacher?.active) fail("Compte enseignant inactif.", 403);
  return teacher;
}

async function studentFromToken(db: any, token: string) {
  if (!token) fail("Ta session est expirée. Reconnecte-toi.", 401);
  const hash = await sha256Hex(token);
  const { data: session } = await db.from("school_student_sessions")
    .select("student_email,expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) fail("Ta session est expirée. Reconnecte-toi.", 401);
  const { data: student } = await db.from("school_students")
    .select("email,group_code,active")
    .eq("email", session.student_email)
    .maybeSingle();
  if (!student?.active) fail("Ton accès n’est plus actif.", 403);
  return student;
}

function cleanText(value: unknown, max = 12000) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

async function saveBatch(db: any, body: any) {
  await teacherFromToken(db, String(body.token || ""));
  const formativeId = cleanText(body.formativeId, 200);
  const rows = Array.isArray(body.items) ? body.items : [];
  if (!formativeId || !rows.length) fail("Aucun commentaire Formative à enregistrer.");

  const assignmentIds = [...new Set(rows.map((x: any) => String(x.assignmentId || "")).filter(Boolean))];
  if (!assignmentIds.length) fail("Aucun travail de destination n’a été trouvé.");

  const { data: assignments, error: aErr } = await db.from("school_assignments")
    .select("id,group_codes,formative_id,formative_question_ids")
    .in("id", assignmentIds);
  if (aErr) fail("Impossible de vérifier les travaux de destination.", 500);
  const assignmentMap = new Map((assignments || []).map((a: any) => [String(a.id), a]));

  const emails = [...new Set(rows.map((x: any) => String(x.email || "").trim().toLowerCase()).filter(Boolean))];
  const { data: students, error: sErr } = emails.length
    ? await db.from("school_students").select("email,group_code,active").in("email", emails)
    : { data: [], error: null };
  if (sErr) fail("Impossible de vérifier les élèves.", 500);
  const studentMap = new Map((students || []).map((s: any) => [String(s.email).toLowerCase(), s]));

  const upserts: any[] = [];
  const deletes: { assignmentId: string; email: string; itemId: string }[] = [];
  let skipped = 0;

  for (const raw of rows) {
    const assignmentId = String(raw.assignmentId || "");
    const email = String(raw.email || "").trim().toLowerCase();
    const itemId = cleanText(raw.formativeItemId || raw.questionId, 200);
    const assignment = assignmentMap.get(assignmentId);
    const student = studentMap.get(email);
    if (!assignment || !student?.active || !(assignment.group_codes || []).includes(student.group_code)) { skipped++; continue; }
    if (assignment.formative_id && String(assignment.formative_id) !== formativeId) { skipped++; continue; }
    const linkedIds = Array.isArray(assignment.formative_question_ids) ? assignment.formative_question_ids.map(String) : [];
    if (linkedIds.length && !linkedIds.includes(itemId)) { skipped++; continue; }

    const feedback = cleanText(raw.feedback, 12000);
    if (!feedback) {
      deletes.push({ assignmentId, email, itemId });
      continue;
    }

    upserts.push({
      assignment_id: assignmentId,
      student_email: email,
      formative_id: formativeId,
      formative_item_id: itemId,
      question_number: cleanText(raw.questionNumber, 40),
      question_label: cleanText(raw.questionLabel, 500),
      feedback,
      feedback_message_id: cleanText(raw.feedbackMessageId, 200) || null,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length) {
    const { error } = await db.from("school_formative_feedbacks")
      .upsert(upserts, { onConflict: "assignment_id,student_email,formative_item_id" });
    if (error) fail("Impossible d’enregistrer les commentaires dans Gestion des notes.", 500);
  }
  for (const d of deletes) {
    await db.from("school_formative_feedbacks")
      .delete()
      .eq("assignment_id", d.assignmentId)
      .eq("student_email", d.email)
      .eq("formative_item_id", d.itemId);
  }
  return { savedCount: upserts.length, removedCount: deletes.length, skipped };
}

async function teacherList(db: any, body: any) {
  await teacherFromToken(db, String(body.token || ""));
  const assignmentId = String(body.assignmentId || "");
  if (!assignmentId) fail("Travail invalide.");
  const { data, error } = await db.from("school_formative_feedbacks")
    .select("student_email,formative_id,formative_item_id,question_number,question_label,feedback,feedback_message_id,updated_at")
    .eq("assignment_id", assignmentId)
    .order("question_number", { ascending: true });
  if (error) fail("Impossible de charger les commentaires Formative.", 500);
  return { items: data || [] };
}

async function studentList(db: any, body: any) {
  const student = await studentFromToken(db, String(body.token || ""));
  const { data: rows, error } = await db.from("school_formative_feedbacks")
    .select("assignment_id,formative_item_id,question_number,question_label,feedback,updated_at")
    .eq("student_email", student.email)
    .order("question_number", { ascending: true });
  if (error) fail("Impossible de charger les rétroactions.", 500);
  if (!(rows || []).length) return { items: [] };

  const ids = [...new Set((rows || []).map((r: any) => r.assignment_id))];
  const { data: assignments, error: aErr } = await db.from("school_assignments")
    .select("id,published,group_codes")
    .in("id", ids);
  if (aErr) fail("Impossible de vérifier les travaux.", 500);
  const visible = new Set((assignments || [])
    .filter((a: any) => a.published && (a.group_codes || []).includes(student.group_code))
    .map((a: any) => String(a.id)));

  return { items: (rows || []).filter((r: any) => visible.has(String(r.assignment_id))).map((r: any) => ({
    assignmentId: r.assignment_id,
    questionId: r.formative_item_id,
    questionNumber: r.question_number || "",
    questionLabel: r.question_label || "",
    feedback: r.feedback || "",
    updatedAt: r.updated_at,
  })) };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  try {
    if (req.method !== "POST") fail("Méthode non permise.", 405);
    if (origin && origin !== ALLOWED_ORIGIN) fail("Origine non autorisée.", 403);
    requireKey(req);
    const body = await req.json();
    const action = String(body.action || "");
    const db = admin();
    let out: any;
    if (action === "saveBatch") out = await saveBatch(db, body);
    else if (action === "teacherList") out = await teacherList(db, body);
    else if (action === "studentList") out = await studentList(db, body);
    else fail("Demande inconnue.");
    return json({ ok: true, ...out }, 200, origin);
  } catch (error) {
    const err = error as Error & { status?: number };
    console.error(err.message);
    return json({ ok: false, message: err.message || "Une erreur est survenue." }, err.status || 500, origin);
  }
});
