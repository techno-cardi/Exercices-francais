import {yearRpc} from '../_shared/school-years.ts';
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

async function saveBatch(db:any,body:any){
 const teacher=await teacherFromToken(db,String(body.token||''));
 if(!String(body.formativeId||'').trim()||!Array.isArray(body.items)||!body.items.length||body.items.length>5000)fail('Lot de commentaires invalide.');
 const result=await yearRpc(db,'cardinal_save_annual_feedback',{p_teacher:teacher.email,p_formative:String(body.formativeId).trim(),p_rows:body.items,p_year:body.schoolYear==null?null:Number(body.schoolYear)});
 return{...result,savedCount:result.saved,removedCount:result.deleted};
}

async function teacherList(db: any, body: any) {
  await teacherFromToken(db, String(body.token || ""));
  const assignmentId = String(body.assignmentId || "");
  if (!assignmentId) fail("Travail invalide.");
  return {items:await yearRpc(db,'cardinal_teacher_annual_feedback',{p_id:assignmentId})};
}

async function studentList(db:any,body:any){
 const student=await studentFromToken(db,String(body.token||''));
 return{items:await yearRpc(db,'cardinal_student_annual_feedback',{p_email:student.email})};
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
