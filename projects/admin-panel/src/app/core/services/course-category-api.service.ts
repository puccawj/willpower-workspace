import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiCourseCategory {
  id: string;
  name: string;
  active: boolean;
}

export interface CourseCategoryPayload {
  name: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CourseCategoryApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/course-categories`;

  readonly categories = signal<ApiCourseCategory[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiCourseCategory[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.categories.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load course categories.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(payload: CourseCategoryPayload) {
    return this.http
      .post<ApiCourseCategory>(this.baseUrl, payload)
      .pipe(tap((category) => this.categories.update((list) => [...list, category])));
  }

  update(id: string, payload: Partial<CourseCategoryPayload>) {
    return this.http
      .patch<ApiCourseCategory>(`${this.baseUrl}/${id}`, payload)
      .pipe(tap((category) => this.categories.update((list) => list.map((c) => (c.id === id ? category : c)))));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.categories.update((list) => list.filter((c) => c.id !== id))),
    );
  }
}
