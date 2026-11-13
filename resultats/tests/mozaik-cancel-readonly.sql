-- PostgreSQL READ-ONLY regression fixtures for the draft cancellation migration.
-- Execute as SELECT only, against any PostgreSQL environment. No real jobs or grades.
WITH cases(name,payload,checkpoint,expected_preserved) AS (
 VALUES
 ('missing_protocol','{"link":{"activityId":"abc"}}'::jsonb,'{"phase":"planned","reviewConfirmed":true,"activityId":"abc"}'::jsonb,true),
 ('valid_existing','{"protocolVersion":2,"link":{"activityId":"abc"}}'::jsonb,'{"phase":"planned","reviewConfirmed":true,"activityId":"abc"}'::jsonb,false),
 ('missing_link','{"protocolVersion":2}'::jsonb,'{"phase":"planned","reviewConfirmed":true,"activityId":"abc"}'::jsonb,true),
 ('wrong_activity','{"protocolVersion":2,"link":{"activityId":"wrong"}}'::jsonb,'{"phase":"planned","reviewConfirmed":true,"activityId":"abc"}'::jsonb,true),
 ('switched_destination','{"protocolVersion":2,"link":{"activityId":"abc"},"previousLink":{"activityId":"old"}}'::jsonb,'{"phase":"planned","reviewConfirmed":true,"activityId":"abc"}'::jsonb,true),
 ('grades_may_have_started','{"protocolVersion":2,"link":{"activityId":"abc"}}'::jsonb,'{"phase":"parameters_verified","reviewConfirmed":true,"activityId":"abc"}'::jsonb,true),
 ('not_yet_reviewed','{"protocolVersion":2,"link":{"activityId":"abc"}}'::jsonb,'{"phase":"planned","reviewConfirmed":false,"activityId":"abc"}'::jsonb,false)
), decisions AS (
 SELECT name,expected_preserved,checkpoint,
 COALESCE((
 payload->>'protocolVersion'='2'
 AND checkpoint->>'phase'='planned'
 AND checkpoint->>'reviewConfirmed'='true'
 AND COALESCE(payload#>>'{link,activityId}','')<>''
 AND payload#>>'{link,activityId}'=checkpoint->>'activityId'
 AND NOT(payload?'previousLink')
 ),FALSE) AS reviewed_planned
 FROM cases
), verdict AS (
 SELECT name,expected_preserved,
 (checkpoint->>'phase' IS DISTINCT FROM 'planned'
 OR (checkpoint->>'reviewConfirmed'='true' AND reviewed_planned IS NOT TRUE)) AS actually_preserved
 FROM decisions
)
SELECT name,expected_preserved,actually_preserved,(expected_preserved=actually_preserved) AS passed
FROM verdict ORDER BY name;
