import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiRsvpStatus = 'confirm' | 'maybe' | 'cancel';

export interface ApiAttendee {
  userId: string;
  name: string;
  email: string;
  status: ApiRsvpStatus;
  checkedIn: boolean;
}

export interface ApiWaitlistEntry {
  userId: string;
  name: string;
  email: string;
  position: number;
}

@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  private readonly http = inject(HttpClient);

  readonly attendees = signal<ApiAttendee[]>([]);
  readonly waitlist = signal<ApiWaitlistEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  private baseUrl(eventId: string): string {
    return `${environment.apiUrl}/events/${eventId}`;
  }

  load(eventId: string) {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiAttendee[]>(`${this.baseUrl(eventId)}/attendees`).pipe(
      tap({
        next: (rows) => {
          this.attendees.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load attendees.');
          this.loading.set(false);
        },
      }),
      tap(() => this.loadWaitlist(eventId).subscribe()),
    );
  }

  loadWaitlist(eventId: string) {
    return this.http.get<ApiWaitlistEntry[]>(`${this.baseUrl(eventId)}/waitlist`).pipe(
      tap((rows) => this.waitlist.set(rows)),
    );
  }

  addAttendee(eventId: string, userId: string, status: ApiRsvpStatus = 'confirm') {
    return this.http.post<{ waitlisted: boolean }>(`${this.baseUrl(eventId)}/attendees`, { userId, status }).pipe(
      tap(() => {
        this.load(eventId).subscribe();
      }),
    );
  }

  updateAttendee(eventId: string, userId: string, status: ApiRsvpStatus) {
    return this.http.patch<void>(`${this.baseUrl(eventId)}/attendees/${userId}`, { status }).pipe(
      tap(() => this.load(eventId).subscribe()),
    );
  }

  removeAttendee(eventId: string, userId: string) {
    return this.http.delete<void>(`${this.baseUrl(eventId)}/attendees/${userId}`).pipe(
      tap(() => this.load(eventId).subscribe()),
    );
  }

  toggleCheckin(eventId: string, userId: string) {
    return this.http.post<{ checkedIn: boolean }>(`${this.baseUrl(eventId)}/attendees/${userId}/checkin`, {}).pipe(
      tap((res) =>
        this.attendees.update((list) => list.map((a) => (a.userId === userId ? { ...a, checkedIn: res.checkedIn } : a))),
      ),
    );
  }

  promote(eventId: string) {
    return this.http.post<void>(`${this.baseUrl(eventId)}/waitlist/promote`, {}).pipe(
      tap(() => this.load(eventId).subscribe()),
    );
  }

  getCheckinQr(eventId: string) {
    return this.http.get<{ code: string; qrDataUrl: string }>(`${this.baseUrl(eventId)}/checkin-qr`);
  }
}
