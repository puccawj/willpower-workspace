import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiCourseNeedType = 'money' | 'goods';

export interface ApiCourseNeed {
  id: string;
  courseId: string;
  sessionNumber: number | null;
  title: string;
  type: ApiCourseNeedType;
  unit: string | null;
  targetQuantity: string;
  receivedQuantity: string;
}

export interface CourseNeedPayload {
  title: string;
  sessionNumber?: number;
  type: ApiCourseNeedType;
  unit?: string;
  targetQuantity: number;
}

@Injectable({ providedIn: 'root' })
export class CourseNeedApiService {
  private readonly http = inject(HttpClient);

  readonly needs = signal<ApiCourseNeed[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  private baseUrl(courseId: string): string {
    return `${environment.apiUrl}/courses/${courseId}/needs`;
  }

  load(courseId: string) {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiCourseNeed[]>(this.baseUrl(courseId)).pipe(
      tap({
        next: (rows) => {
          this.needs.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load needs.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(courseId: string, payload: CourseNeedPayload) {
    return this.http
      .post<ApiCourseNeed>(this.baseUrl(courseId), payload)
      .pipe(tap(() => this.load(courseId).subscribe()));
  }

  update(courseId: string, id: string, payload: Partial<CourseNeedPayload>) {
    return this.http
      .patch<ApiCourseNeed>(`${this.baseUrl(courseId)}/${id}`, payload)
      .pipe(tap(() => this.load(courseId).subscribe()));
  }

  remove(courseId: string, id: string) {
    return this.http
      .delete<void>(`${this.baseUrl(courseId)}/${id}`)
      .pipe(tap(() => this.needs.update((list) => list.filter((n) => n.id !== id))));
  }
}
