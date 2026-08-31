import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type StudentApplicationStatus = 'pending' | 'approved' | 'rejected';

/** One row per branch the applicant requested — `id` is the per-branch decision row's id
 * (what approve/reject act on), not the parent application's id. The same applicant can appear
 * as multiple rows if they applied to more than one branch. */
export interface ApiStudentApplication {
  id: string;
  applicationId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string | null;
  lineId: string | null;
  photoUrl: string | null;
  branchId: string;
  branchName: string;
  status: StudentApplicationStatus;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class StudentApplicationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/student-applications`;

  readonly applications = signal<ApiStudentApplication[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load(status: string = 'pending'): Observable<ApiStudentApplication[]> {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiStudentApplication[]>(this.baseUrl, { params: { status } }).pipe(
      tap({
        next: (rows) => {
          this.applications.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load student applications.');
          this.loading.set(false);
        },
      }),
    );
  }

  approve(id: string): Observable<ApiStudentApplication> {
    return this.http
      .patch<ApiStudentApplication>(`${this.baseUrl}/${id}/approve`, {})
      .pipe(tap(() => this.applications.update((rows) => rows.filter((r) => r.id !== id))));
  }

  reject(id: string): Observable<ApiStudentApplication> {
    return this.http
      .patch<ApiStudentApplication>(`${this.baseUrl}/${id}/reject`, {})
      .pipe(tap(() => this.applications.update((rows) => rows.filter((r) => r.id !== id))));
  }
}
