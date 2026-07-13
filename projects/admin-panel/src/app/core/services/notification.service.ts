import { Injectable, computed, signal } from '@angular/core';

export interface AppNotification {
  id: number;
  message: string;
  timestamp: Date;
  read: boolean;
}

let nextId = 1;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  add(message: string): void {
    this.notifications.update((list) => [
      { id: nextId++, message, timestamp: new Date(), read: false },
      ...list,
    ]);
  }

  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }
}
