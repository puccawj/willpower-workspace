import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MyNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me/notifications`;

  readonly notifications = signal<MyNotification[]>([]);
  readonly unreadCount = signal(0);

  load(): Observable<MyNotification[]> {
    return this.http.get<MyNotification[]>(this.baseUrl).pipe(tap((rows) => this.notifications.set(rows)));
  }

  loadUnreadCount(): Observable<{ count: number }> {
    return this.http
      .get<{ count: number }>(`${this.baseUrl}/unread-count`)
      .pipe(tap((res) => this.unreadCount.set(res.count)));
  }

  markRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this.notifications.update((rows) => rows.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        this.unreadCount.update((c) => Math.max(0, c - 1));
      }),
    );
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/mark-all-read`, {}).pipe(
      tap(() => {
        this.notifications.update((rows) => rows.map((n) => ({ ...n, isRead: true })));
        this.unreadCount.set(0);
      }),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const wasUnread = this.notifications().find((n) => n.id === id)?.isRead === false;
        this.notifications.update((rows) => rows.filter((n) => n.id !== id));
        if (wasUnread) this.unreadCount.update((c) => Math.max(0, c - 1));
      }),
    );
  }
}
