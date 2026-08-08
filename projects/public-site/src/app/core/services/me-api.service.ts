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
  needId?: string;
  courseId?: string;
  courseNeedId?: string;
  offeringId?: string;
  quantity?: number;
  proofImage?: string;
}

export interface MyRating {
  id: string;
  stars: number;
  note: string | null;
}

export type StudentApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface MyStudentApplication {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string | null;
  lineId: string | null;
  photoUrl: string | null;
  status: StudentApplicationStatus;
  createdAt: string;
}

export interface StudentApplicationRequest {
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone?: string;
  lineId?: string;
  photoUrl?: string;
}

export interface UpdateStudentApplicationRequest {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phone?: string;
  lineId?: string;
  photoUrl?: string;
}

export interface MyProfile {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  email: string;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  role: string;
  initials: string;
  registrationSource: string;
}

export interface UpdateMyProfileRequest {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
}

export interface ChangeMyPasswordRequest {
  currentPassword: string;
  newPassword: string;
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

  myEventRating(eventId: string): Observable<MyRating | null> {
    return this.http.get<MyRating | null>(`${this.baseUrl}/events/${eventId}/rating`);
  }

  rateEvent(eventId: string, stars: number, note?: string): Observable<MyRating> {
    return this.http.put<MyRating>(`${this.baseUrl}/events/${eventId}/rating`, { stars, note });
  }

  myOfferingRating(offeringId: string): Observable<MyRating | null> {
    return this.http.get<MyRating | null>(`${this.baseUrl}/course-offerings/${offeringId}/rating`);
  }

  rateOffering(offeringId: string, stars: number, note?: string): Observable<MyRating> {
    return this.http.put<MyRating>(`${this.baseUrl}/course-offerings/${offeringId}/rating`, { stars, note });
  }

  myStudentApplication(): Observable<MyStudentApplication | null> {
    return this.http.get<MyStudentApplication | null>(`${this.baseUrl}/student-application`);
  }

  applyForStudent(dto: StudentApplicationRequest): Observable<MyStudentApplication> {
    return this.http.post<MyStudentApplication>(`${this.baseUrl}/student-application`, dto);
  }

  updateStudentApplication(dto: UpdateStudentApplicationRequest): Observable<MyStudentApplication> {
    return this.http.patch<MyStudentApplication>(`${this.baseUrl}/student-application`, dto);
  }

  getProfile(): Observable<MyProfile> {
    return this.http.get<MyProfile>(this.baseUrl);
  }

  updateProfile(dto: UpdateMyProfileRequest): Observable<MyProfile> {
    return this.http.patch<MyProfile>(this.baseUrl, dto);
  }

  changePassword(dto: ChangeMyPasswordRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/password`, dto);
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
