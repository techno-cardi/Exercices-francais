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
  const e = new Error(message) as Error & { status?: number };
  e.status = status;
  throw e;
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

async function sha256Hex(v: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(v)));
  return [...d].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function requireTeacher(db: ReturnType<typeof admin>, token: string) {
  if (!token) fail("Session enseignant expirée.", 401);
  const tokenHash = await sha256Hex(token);
  const { data: session } = await db
    .from("school_teacher_sessions")
    .select("teacher_email,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) fail("Session enseignant expirée.", 401);
  const { data: teacher } = await db
    .from("school_teachers")
    .select("email,active")
    .eq("email", session.teacher_email)
    .maybeSingle();
  if (!teacher?.active) fail("Compte enseignant inactif.", 403);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

  try {
    if (req.method !== "POST") fail("Méthode non permise.", 405);
    if (origin && origin !== ALLOWED_ORIGIN) fail("Origine non autorisée.", 403);
    requireKey(req);

    const body = await req.json().catch(() => null) as { token?: string; assignmentId?: string } | null;
    if (!body) fail("Requête invalide.");

    const db = admin();
    await requireTeacher(db, String(body.token || ""));

    const assignmentId = String(body.assignmentId || "").trim();
    if (!assignmentId) fail("Travail invalide.");

    const { data: assignment, error: readError } = await db
      .from("school_assignments")
      .select("id,title")
      .eq("id", assignmentId)
      .maybeSingle();
    if (readError) fail("Impossible de vérifier le travail.", 500);
    if (!assignment) fail("Travail introuvable.", 404);

    const { error: deleteError } = await db
      .from("school_assignments")
      .delete()
      .eq("id", assignmentId);
    if (deleteError) fail("Impossible de supprimer le travail.", 500);

    return json({ ok: true, deleted: true, assignmentId, title: assignment.title }, 200, origin);
  } catch (error) {
    const e = error as Error & { status?: number };
    console.error(e.message);
    return json({ ok: false, message: e.message || "Une erreur est survenue." }, e.status || 500, origin);
  }
});

