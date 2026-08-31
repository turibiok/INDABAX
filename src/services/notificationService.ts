import { Session, PushNotificationAlert } from '../types';

class NotificationService {
  private permission: NotificationPermission = 'default';
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const status = await Notification.requestPermission();
        this.permission = status;
        return status;
      } catch (err) {
        console.warn('Error requesting notification permission:', err);
        return 'denied';
      }
    }
    return 'denied';
  }

  public playNotificationChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      // Audio context might be blocked by autoplay policies until user interaction
    }
  }

  public sendPushNotification(title: string, options?: NotificationOptions): boolean {
    this.playNotificationChime();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        return true;
      } catch (e) {
        console.warn('Could not trigger native notification:', e);
      }
    }
    return false;
  }

  /**
   * Check if any saved session is starting in ~15 minutes
   * Given sessions and savedSessionIds, checks time differences
   */
  public checkUpcomingSessions(
    sessions: Session[],
    savedSessionIds: string[],
    alertedSessionIds: Set<string>
  ): PushNotificationAlert[] {
    const alerts: PushNotificationAlert[] = [];
    const now = new Date();

    // Helper: Parse session start time into Date
    // Sessions have format: date "2026-09-18", startTime "09:00"
    for (const session of sessions) {
      if (!savedSessionIds.includes(session.id)) continue;
      if (alertedSessionIds.has(session.id)) continue;

      try {
        const [hours, minutes] = session.startTime.split(':').map(Number);
        const sessionDate = new Date(session.date);
        sessionDate.setHours(hours, minutes, 0, 0);

        const diffMinutes = (sessionDate.getTime() - now.getTime()) / (1000 * 60);

        // Alert if between 0 and 16 minutes before start (or 15 min window)
        if (diffMinutes > 0 && diffMinutes <= 16) {
          const alert: PushNotificationAlert = {
            id: `alert-${session.id}-${Date.now()}`,
            sessionId: session.id,
            sessionTitle: session.title,
            speaker: session.speaker,
            room: session.room,
            startTime: session.startTime,
            minutesRemaining: Math.ceil(diffMinutes),
            timestamp: new Date().toISOString(),
            read: false
          };

          alerts.push(alert);

          // Fire native notification
          this.sendPushNotification(`⏰ Début dans ${Math.ceil(diffMinutes)} min : ${session.title}`, {
            body: `Avec ${session.speaker} en ${session.room}. Rendez-vous en salle !`,
            tag: `session-${session.id}`
          });
        }
      } catch (err) {
        console.warn('Error calculating session time', err);
      }
    }

    return alerts;
  }
}

export const notificationService = new NotificationService();
