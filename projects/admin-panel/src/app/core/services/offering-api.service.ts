import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiOfferingMode = 'online' | 'onsite';
export type ApiOfferingStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface ApiOffering {
  id: string;
  courseId: string;
  courseTitle: string;
  totalSessions: number;
  branchId: string;
  branchName: string;
  instructorId: string | null;
  instructorName: string | null;
  startDate: string;
  endDate: string;
  capacity: number | null;
  location: string | null;
  mode: ApiOfferingMode;
  status: ApiOfferingStatus;
  enrolledCount: number;
}

export interface ApiCourseSession {
  id: string;
  offeringId: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  topic: string | null;
  location: string | null;
}

export interface OfferingPayload {
  courseId: string;
  branchId: string;
  instructorId?: string;
  startDate: string;
  endDate: string;
  capacity?: number;
  location?: string;
  mode: ApiOfferingMode;
  status?: ApiOfferingStatus;
}

@Injectable({ providedIn: 'root' })
export class OfferingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/course-offerings`;

  readonly offerings = signal<ApiOffering[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiOffering[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.offerings.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load class offerings.');
          this.loading.set(false);
        },
      }),
    );
  }

  listSessions(offeringId: string) {
    return this.http.get<ApiCourseSession[]>(`${this.baseUrl}/${offeringId}/sessions`);
  }

  create(payload: OfferingPayload) {
    return this.http.post<ApiOffering>(this.baseUrl, payload).pipe(switchMap(() => this.load()));
  }

  update(id: string, payload: Partial<OfferingPayload>) {
    return this.http.patch<ApiOffering>(`${this.baseUrl}/${id}`, payload).pipe(switchMap(() => this.load()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(switchMap(() => this.load()));
  }
}
