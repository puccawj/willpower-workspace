import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiEnrollmentRow {
  userId: string;
  name: string;
  email: string;
  status: string;
  enrolledAt: string;
  attendedSessions: number;
  totalSessions: number;
  attendancePercent: number;
  presentThisSession: boolean;
}

@Injectable({ providedIn: 'root' })
export class EnrollmentApiService {
  private readonly http = inject(HttpClient);

  readonly enrollments = signal<ApiEnrollmentRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  private baseUrl(offeringId: string): string {
    return `${environment.apiUrl}/course-offerings/${offeringId}`;
  }

  load(offeringId: string, sessionId?: string) {
    this.loading.set(true);
    this.error.set('');
    const url = sessionId
      ? `${this.baseUrl(offeringId)}/enrollments?sessionId=${sessionId}`
      : `${this.baseUrl(offeringId)}/enrollments`;
    return this.http.get<ApiEnrollmentRow[]>(url).pipe(
      tap({
        next: (rows) => {
          this.enrollments.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load enrollments.');
          this.loading.set(false);
        },
      }),
    );
  }

  enroll(offeringId: string, userId: string, sessionId?: string) {
    return this.http
      .post<void>(`${this.baseUrl(offeringId)}/enrollments`, { userId })
      .pipe(switchMap(() => this.load(offeringId, sessionId)));
  }

  removeEnrollment(offeringId: string, userId: string, sessionId?: string) {
    return this.http
      .delete<void>(`${this.baseUrl(offeringId)}/enrollments/${userId}`)
      .pipe(switchMap(() => this.load(offeringId, sessionId)));
  }

  toggleAttendance(offeringId: string, sessionId: string, userId: string) {
    return this.http
      .post<{ checkedIn: boolean }>(`${this.baseUrl(offeringId)}/sessions/${sessionId}/attendance/${userId}`, {})
      .pipe(switchMap((res) => this.load(offeringId, sessionId).pipe(switchMap(() => [res]))));
  }

  getSessionCheckinQr(offeringId: string, sessionId: string) {
    return this.http.get<{ code: string; qrDataUrl: string }>(`${this.baseUrl(offeringId)}/sessions/${sessionId}/checkin-qr`);
  }
}
