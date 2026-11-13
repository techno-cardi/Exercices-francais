-- Allow a teacher to abandon a reviewed but not yet grade-written Mozaïk batch.
-- This does NOT undo possible Mozaïk activity-parameter changes. It never edits grades.
-- Cardinal's guarded writer durably checkpoints parameters_verified BEFORE PUT results.
-- Row locking makes cancellation mutually exclusive with that checkpoint.
CREATE OR REPLACE FUNCTION public.cardinal_cancel_unwritten_mozaik_job(p_teacher text, p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  j public.school_mozaik_sync_jobs;
  reviewed_planned boolean := false;
BEGIN
  SELECT * INTO j FROM public.school_mozaik_sync_jobs WHERE id=p_job_id FOR UPDATE;
  IF j.id IS NULL OR j.teacher_email IS DISTINCT FROM p_teacher
    OR NOT EXISTS(SELECT 1 FROM public.school_teachers WHERE email=p_teacher AND active)
  THEN RAISE EXCEPTION 'invalid_job_owner'; END IF;

  IF j.status='expired'
     AND j.result->>'reason' IN ('explicit_prewrite_cancel','explicit_reviewed_pregrade_cancel')
  THEN RETURN jsonb_build_object('mode','cancelled','jobId',j.id,
    'activitySettingsMayHaveChanged',COALESCE((j.result->>'activitySettingsMayHaveChanged')::boolean,FALSE),
    'gradeWritesConfirmedAbsent',true); END IF;

  IF j.status<>'claimed' THEN RAISE EXCEPTION 'invalid_job_status'; END IF;

  -- New clients persist this marker before a native activity PUT. A missing
  -- response is not proof of rejection. Preserve unknown/in-flight requests.
  IF j.checkpoint ? 'activityWrite' AND
     COALESCE(j.checkpoint#>>'{activityWrite,state}','') NOT IN ('confirmed','rejected') THEN
    RETURN jsonb_build_object('mode','preserved','jobId',j.id,'reason','native_request_uncertain');
  END IF;

  -- A reviewed planned checkpoint can mean the activity PUT happened, but by
  -- protocol the grades PUT cannot begin until parameters_verified is stored.
  -- Permit abandonment ONLY of an existing, exact, linked activity: do not
  -- silently orphan a freshly created activity or a switched destination.
  reviewed_planned := COALESCE((
    j.payload->>'protocolVersion'='2'
    AND j.checkpoint->>'phase'='planned'
    AND j.checkpoint->>'reviewConfirmed'='true'
    AND COALESCE(j.payload#>>'{link,activityId}','')<>''
    AND j.payload#>>'{link,activityId}'=j.checkpoint->>'activityId'
    AND NOT (j.payload ? 'previousLink')
  ), FALSE);

  IF j.checkpoint IS NOT NULL
     AND (j.checkpoint->>'phase' IS DISTINCT FROM 'planned'
          OR (j.checkpoint->>'reviewConfirmed'='true' AND reviewed_planned IS NOT TRUE))
  THEN
    RETURN jsonb_build_object('mode','preserved','jobId',j.id);
  END IF;

  UPDATE public.school_mozaik_sync_jobs
     SET status='expired',completed_at=clock_timestamp(),
         result=jsonb_build_object(
           'cancelled',true,
           'reason', CASE WHEN reviewed_planned THEN 'explicit_reviewed_pregrade_cancel'
                          ELSE 'explicit_prewrite_cancel' END,
           'activitySettingsMayHaveChanged',reviewed_planned)
   WHERE id=p_job_id;
  RETURN jsonb_build_object('mode','cancelled','jobId',j.id,
                            'activitySettingsMayHaveChanged',reviewed_planned,
                            'gradeWritesConfirmedAbsent',true);
END $function$;

REVOKE ALL ON FUNCTION public.cardinal_cancel_unwritten_mozaik_job(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cardinal_cancel_unwritten_mozaik_job(text,uuid) TO service_role;
