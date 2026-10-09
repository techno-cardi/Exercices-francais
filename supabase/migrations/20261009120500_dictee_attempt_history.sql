ALTER TABLE public.fr_dictee_feedback
 ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
 ADD COLUMN IF NOT EXISTS attempt_history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attempt_history) = 'array');

CREATE OR REPLACE FUNCTION public.fr_dictee_restart(p_assignment_id uuid, p_student_email text, p_expected_attempt integer)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE f public.fr_dictee_feedback%ROWTYPE; t timestamptz := clock_timestamp(); snapshot jsonb;
BEGIN
 SELECT * INTO f FROM public.fr_dictee_feedback
 WHERE assignment_id=p_assignment_id AND student_email=p_student_email FOR UPDATE;
 IF NOT FOUND OR NOT f.released OR NOT f.errors_verified THEN
  RAISE EXCEPTION 'Parcours indisponible';
 END IF;
 IF f.attempt_number IS DISTINCT FROM p_expected_attempt THEN
  RAISE EXCEPTION 'Tentative déjà modifiée' USING ERRCODE='40001';
 END IF;
 snapshot := jsonb_build_object('attemptNumber',f.attempt_number,'startedAt',f.started_at,
  'copyOpenedAt',f.copy_opened_at,'bilanSeenAt',f.bilan_seen_at,'completedAt',f.completed_at,
  'restartedAt',t,'understoodKeys',to_jsonb(f.understood_keys),
  'strategyKeys',to_jsonb(f.strategy_passed_keys),'totalErrors',jsonb_array_length(f.errors));
 UPDATE public.fr_dictee_feedback SET
  attempt_history=f.attempt_history || jsonb_build_array(snapshot), attempt_number=f.attempt_number+1,
  started_at=t, copy_opened_at=NULL, bilan_seen_at=NULL, completed_at=NULL,
  understood_keys='{}'::text[], strategy_passed_keys='{}'::text[], updated_at=t
 WHERE assignment_id=p_assignment_id AND student_email=p_student_email;
 -- Keep academic results, copy, correction, secret hash and secret lock unchanged.
 RETURN f.attempt_number+1;
END;
$$;
REVOKE ALL ON FUNCTION public.fr_dictee_restart(uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fr_dictee_restart(uuid,text,integer) TO service_role;
