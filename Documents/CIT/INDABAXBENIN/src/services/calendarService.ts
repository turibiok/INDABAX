import { Session } from '../types';

/**
 * Service to handle single and bulk synchronization of IndabaX sessions
 * avec Google Calendar, uniquement via des LIENS : web intent Google Calendar
 * et fichiers .ICS (RFC 5545). Aucun jeton OAuth ni projet Google Cloud requis.
 */

// Helper to format ISO Date to Google Calendar compact format: YYYYMMDDTHHmmssZ
function formatGCalDate(dateStr: string, timeStr: string): string {
  // e.g. date: "2026-09-18", time: "09:00"
  // Benin is UTC+1 (West Africa Time) -> convert to UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Date in UTC (Benin is UTC+1, so UTC hour = hours - 1)
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours - 1, minutes, 0));
  
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = utcDate.getUTCFullYear();
  const m = pad(utcDate.getUTCMonth() + 1);
  const d = pad(utcDate.getUTCDate());
  const h = pad(utcDate.getUTCHours());
  const min = pad(utcDate.getUTCMinutes());
  const s = pad(utcDate.getUTCSeconds());

  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Generates an instant 1-Click Google Calendar Web Intent URL
 */
export function getGoogleCalendarUrl(session: Session): string {
  const startStr = formatGCalDate(session.date, session.startTime);
  const endStr = formatGCalDate(session.date, session.endTime);
  const title = encodeURIComponent(`[IndabaX Bénin] ${session.title}`);
  
  const details = encodeURIComponent(
    `IndabaX Bénin 2026 • Conférence & Hackathon IA\n\n` +
    `👨‍🏫 Conférencier: ${session.speaker} (${session.speakerInstitution})\n` +
    `🏷️ Thématique: ${session.track}\n` +
    `🎯 Type & Niveau: ${session.type} (${session.level})\n\n` +
    `📝 Description:\n${session.description}\n\n` +
    `🔗 En savoir plus & ressources: https://indabax.bj`
  );
  
  const location = encodeURIComponent(`${session.room}, Campus UAC / Sèmè City, Cotonou, Bénin`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}&add=${encodeURIComponent('https://indabax.bj')}`;
}

/**
 * Downloads a standard .ICS file containing multiple or all selected sessions
 * which can be directly imported into Google Calendar (via Settings > Import).
 */
export function downloadIcsFile(sessions: Session[], calendarName = "IndabaX_Benin_2026_Mon_Planning") {
  if (sessions.length === 0) return;

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IndabaX Benin 2026//Baobab AI Conference//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:IndabaX Bénin 2026 - Mon Agenda',
    'X-WR-TIMEZONE:Africa/Porto-Novo'
  ];

  sessions.forEach(session => {
    const dtStart = formatGCalDate(session.date, session.startTime);
    const dtEnd = formatGCalDate(session.date, session.endTime);
    const now = formatGCalDate(new Date().toISOString().slice(0, 10), "12:00");
    const summary = `[IndabaX Bénin] ${session.title.replace(/,/g, '\\,')}`;
    const description = `Conférencier: ${session.speaker} (${session.speakerInstitution})\\nTrack: ${session.track}\\nSalle: ${session.room}\\n\\n${session.description.replace(/\n/g, '\\n')}`;
    const location = `${session.room}, Cotonou, Bénin`;

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${session.id}-2026@indabax.bj`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT20M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Rappel Session IndabaX',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${calendarName}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Ouvre Google Calendar pre-rempli pour la session demandee.
 * Fonctionne sans authentification : c'est un simple lien.
 */
export async function syncSessionToGoogle(
  session: Session,
): Promise<{ success: boolean; url?: string; message: string }> {
  const url = getGoogleCalendarUrl(session);
  window.open(url, '_blank', 'noopener,noreferrer');

  return {
    success: true,
    url,
    message: `Ouverture de Google Calendar pour ajouter "${session.title}"...`,
  };
}
