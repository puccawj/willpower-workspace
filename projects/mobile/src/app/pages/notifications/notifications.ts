import { Component, inject } from '@angular/core';
import { NotificationApiService } from '../../core/services/notification-api.service';
import { BackButton } from '../../shared/back-button/back-button';

@Component({
  selector: 'app-notifications',
  imports: [BackButton],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  protected readonly api = inject(NotificationApiService);

  constructor() {
    this.api.load().subscribe();
  }

  markRead(id: string): void {
    this.api.markRead(id).subscribe();
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe();
  }

  deleteNotification(id: string, event: Event): void {
    event.stopPropagation();
    this.api.delete(id).subscribe();
  }

  formatDate(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today · ${time}`;
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
  }

  iconFor(type: string): string {
    switch (type) {
      case 'event_published':
      case 'event_updated':
        return '📅';
      case 'event_cancelled':
        return '⚠️';
      case 'rsvp_reminder':
      case 'class_reminder':
        return '⏰';
      case 'waitlist_promoted':
        return '🎉';
      case 'donation_verified':
        return '💛';
      case 'certificate_issued':
        return '🎓';
      case 'course_completed':
        return '✅';
      case 'absence_alert':
        return '❗';
      default:
        return '🔔';
    }
  }
}
