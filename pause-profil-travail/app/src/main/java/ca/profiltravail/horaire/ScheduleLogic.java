package ca.profiltravail.horaire;
import java.time.*;
public final class ScheduleLogic {
 private ScheduleLogic(){}
 public static boolean isWorkTime(int days,int from,int to,ZonedDateTime now){
   int day=now.getDayOfWeek().getValue(), minute=now.getHour()*60+now.getMinute();
   return (days&(1<<day))!=0 && minute>=from && minute<to;
 }
 public static Instant nextTransition(int days,int from,int to,ZonedDateTime now){
   if(days==0||from<0||to>1440||from>=to)return null;
   Instant next=null;
   for(int offset=0;offset<9;offset++){
     LocalDate date=now.toLocalDate().plusDays(offset);
     if((days&(1<<date.getDayOfWeek().getValue()))==0)continue;
     for(int minute:new int[]{from,to}){
       Instant instant=date.atStartOfDay().plusMinutes(minute).atZone(now.getZone()).toInstant();
       if(instant.isAfter(now.toInstant())&&(next==null||instant.isBefore(next)))next=instant;
     }
   }
   return next;
 }
}
