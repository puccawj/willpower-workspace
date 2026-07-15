import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiCoursePhoto {
  id: string;
  courseId: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

export interface CoursePhotoPayload {
  imageUrl: string;
  caption?: string;
}

@Injectable({ providedIn: 'root' })
export class CoursePhotoApiService {
  private readonly http = inject(HttpClient);

  readonly photos = signal<ApiCoursePhoto[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  private baseUrl(courseId: string): string {
    return `${environment.apiUrl}/courses/${courseId}/photos`;
  }

  load(courseId: string) {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiCoursePhoto[]>(this.baseUrl(courseId)).pipe(
      tap({
        next: (rows) => {
          this.photos.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load photos.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(courseId: string, payload: CoursePhotoPayload) {
    return this.http
      .post<ApiCoursePhoto>(this.baseUrl(courseId), payload)
      .pipe(tap(() => this.load(courseId).subscribe()));
  }

  update(courseId: string, id: string, payload: Partial<CoursePhotoPayload>) {
    return this.http
      .patch<ApiCoursePhoto>(`${this.baseUrl(courseId)}/${id}`, payload)
      .pipe(tap(() => this.load(courseId).subscribe()));
  }

  remove(courseId: string, id: string) {
    return this.http
      .delete<void>(`${this.baseUrl(courseId)}/${id}`)
      .pipe(tap(() => this.photos.update((list) => list.filter((p) => p.id !== id))));
  }
}
