import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type MyRsvpStatus = 'confirm' | 'maybe' | 'cancel';

export interface MyEvent {
  eventId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  location: string | null;
  branchName: string;
  startAt: string;
  endAt: string;
  status: string;
  rsvpStatus: MyRsvpStatus;
  checkedIn: boolean;
}

export interface MyEnrollment {
  offeringId: string;
  courseTitle: string;
  category: string | null;
  branchName: string;
  status: string;
  sessionsTotal: number;
  sessionsAttended: number;
  attendancePercent: number;
  passingPercent: string;
}

export interface MyCertificate {
  id: string;
  courseTitle: string | null;
  templateName: string;
  certificateNo: string;
  issuedAt: string;
  fileUrl: string;
}

export interface MyDonation {
  id: string;
  createdAt: string;
  type: 'money' | 'goods';
  amount: string | null;
  itemDescription: string | null;
  currency: string;
  eventTitle: string | null;
  certificateNo: string | null;
}

export interface MyCourseSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  checkedIn: boolean;
}

export interface DonateRequest {
  donorName: string;
  donorPhoneNumber: string;
  donorEmail: string;
  type: 'money' | 'goods';
  amountOrItem: string;
  branchId: string;
  eventId?: string;
}

@Injectable({ providedIn: 'root' })
export class MeApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me`;

  readonly events = signal<MyEvent[]>([]);
  readonly enrollments = signal<MyEnrollment[]>([]);
  readonly certificates = signal<MyCertificate[]>([]);
  readonly donations = signal<MyDonation[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  loadEvents(): Observable<MyEvent[]> {
    return this.http.get<MyEvent[]>(`${this.baseUrl}/events`).pipe(tap((rows) => this.events.set(rows)));
  }

  setRsvp(eventId: string, status: MyRsvpStatus): Observable<{ ok: true }> {
    return this.http
      .put<{ ok: true }>(`${this.baseUrl}/events/${eventId}/rsvp`, { status })
      .pipe(tap(() => this.loadEvents().subscribe()));
  }

  checkinEvent(eventId: string): Observable<{ title: string; alreadyCheckedIn: boolean }> {
    return this.http
      .post<{ title: string; alreadyCheckedIn: boolean }>(`${this.baseUrl}/events/${eventId}/checkin`, {})
      .pipe(tap(() => this.loadEvents().subscribe()));
  }

  loadEnrollments(): Observable<MyEnrollment[]> {
    return this.http.get<MyEnrollment[]>(`${this.baseUrl}/enrollments`).pipe(tap((rows) => this.enrollments.set(rows)));
  }

  enrollSelf(offeringId: string): Observable<unknown> {
    return this.http
      .post(`${this.baseUrl}/enrollments`, { offeringId })
      .pipe(tap(() => this.loadEnrollments().subscribe()));
  }

  loadMySessions(offeringId: string): Observable<MyCourseSession[]> {
    return this.http.get<MyCourseSession[]>(`${this.baseUrl}/enrollments/${offeringId}/sessions`);
  }

  checkinSession(sessionId: string): Observable<{ title: string; alreadyCheckedIn: boolean }> {
    return this.http.post<{ title: string; alreadyCheckedIn: boolean }>(`${this.baseUrl}/course-sessions/${sessionId}/checkin`, {});
  }

  loadCertificates(): Observable<MyCertificate[]> {
    return this.http.get<MyCertificate[]>(`${this.baseUrl}/certificates`).pipe(tap((rows) => this.certificates.set(rows)));
  }

  loadDonations(): Observable<MyDonation[]> {
    return this.http.get<MyDonation[]>(`${this.baseUrl}/donations`).pipe(tap((rows) => this.donations.set(rows)));
  }

  donate(dto: DonateRequest): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/donations`, dto).pipe(tap(() => this.loadDonations().subscribe()));
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      firstValueFrom(this.loadEvents()),
      firstValueFrom(this.loadEnrollments()),
      firstValueFrom(this.loadCertificates()),
      firstValueFrom(this.loadDonations()),
    ])
      .then(() => this.loading.set(false))
      .catch(() => {
        this.error.set('Unable to load your account data right now.');
        this.loading.set(false);
      });
  }
}
