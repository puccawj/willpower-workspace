import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiCourseStatus = 'active' | 'inactive';

export interface ApiCourse {
  id: string;
  title: string;
  description: string | null;
  syllabus: string | null;
  category: string | null;
  imageUrl: string | null;
  totalSessions: number;
  passingAttendancePercent: string;
  status: ApiCourseStatus;
  offeringsCount: number;
}

export interface CoursePayload {
  title: string;
  description?: string;
  syllabus?: string;
  category?: string;
  image?: string;
  totalSessions: number;
  passingAttendancePercent?: number;
  status?: ApiCourseStatus;
}

@Injectable({ providedIn: 'root' })
export class CourseApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/courses`;

  readonly courses = signal<ApiCourse[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiCourse[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.courses.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load courses.');
          this.loading.set(false);
        },
      }),
    );
  }

  getOne(id: string) {
    return this.http.get<ApiCourse>(`${this.baseUrl}/${id}`);
  }

  create(payload: CoursePayload) {
    return this.http.post<ApiCourse>(this.baseUrl, payload).pipe(switchMap(() => this.load()));
  }

  update(id: string, payload: Partial<CoursePayload>) {
    return this.http.patch<ApiCourse>(`${this.baseUrl}/${id}`, payload).pipe(switchMap(() => this.load()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(switchMap(() => this.load()));
  }
}
