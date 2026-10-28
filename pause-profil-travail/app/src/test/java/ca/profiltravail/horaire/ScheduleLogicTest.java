package ca.profiltravail.horaire;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.*;
public final class ScheduleLogicTest {
 static final int WEEKDAYS=62;
 static ZonedDateTime at(String s){return ZonedDateTime.parse(s);}
 @Test public void boundaries(){
  assertFalse(ScheduleLogic.isWorkTime(WEEKDAYS,480,1020,at("2026-10-26T07:59:00-04:00[America/Toronto]")));
  assertTrue(ScheduleLogic.isWorkTime(WEEKDAYS,480,1020,at("2026-10-26T08:00:00-04:00[America/Toronto]")));
  assertTrue(ScheduleLogic.isWorkTime(WEEKDAYS,480,1020,at("2026-10-26T16:59:00-04:00[America/Toronto]")));
  assertFalse(ScheduleLogic.isWorkTime(WEEKDAYS,480,1020,at("2026-10-26T17:00:00-04:00[America/Toronto]")));
 }
 @Test public void autumnDst(){
  assertFalse(ScheduleLogic.isWorkTime(WEEKDAYS,480,1020,at("2026-10-31T12:00:00-04:00[America/Toronto]")));
  assertEquals(at("2026-11-02T08:00:00-05:00[America/Toronto]").toInstant(),
    ScheduleLogic.nextTransition(WEEKDAYS,480,1020,at("2026-10-30T17:01:00-04:00[America/Toronto]")));
 }
 @Test public void springDst(){
  assertEquals(at("2027-03-15T08:00:00-04:00[America/Toronto]").toInstant(),
    ScheduleLogic.nextTransition(WEEKDAYS,480,1020,at("2027-03-12T17:01:00-05:00[America/Toronto]")));
 }
 @Test public void selectionAndEmpty(){
  assertTrue(ScheduleLogic.isWorkTime(1<<2,480,1020,at("2026-10-27T12:00:00-04:00[America/Toronto]")));
  assertFalse(ScheduleLogic.isWorkTime(1<<2,480,1020,at("2026-10-28T12:00:00-04:00[America/Toronto]")));
  assertNull(ScheduleLogic.nextTransition(0,480,1020,at("2026-10-27T12:00:00-04:00[America/Toronto]")));
 }
 @Test public void nextDay(){
  assertEquals(at("2026-10-28T08:00:00-04:00[America/Toronto]").toInstant(),
    ScheduleLogic.nextTransition(WEEKDAYS,480,1020,at("2026-10-27T17:00:00-04:00[America/Toronto]")));
 }
 @Test public void weekendWorkday(){
  assertEquals(at("2026-10-31T08:00:00-04:00[America/Toronto]").toInstant(),
    ScheduleLogic.nextTransition(1<<6,480,1020,at("2026-10-30T18:00:00-04:00[America/Toronto]")));
 }
 @Test public void invalidSchedule(){
  assertNull(ScheduleLogic.nextTransition(WEEKDAYS,1020,480,at("2026-10-27T10:00:00-04:00[America/Toronto]")));
  assertNull(ScheduleLogic.nextTransition(WEEKDAYS,500,500,at("2026-10-27T10:00:00-04:00[America/Toronto]")));
 }
}
