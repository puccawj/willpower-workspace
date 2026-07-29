import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiHomeBanner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface HomeBannerPayload {
  imageUrl: string;
  linkUrl?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class HomeBannerApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/home-banners`;

  readonly banners = signal<ApiHomeBanner[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load(): Observable<ApiHomeBanner[]> {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiHomeBanner[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.banners.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load Home banners.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(payload: HomeBannerPayload): Observable<ApiHomeBanner> {
    return this.http.post<ApiHomeBanner>(this.baseUrl, payload).pipe(tap((row) => this.banners.update((rows) => [...rows, row])));
  }

  update(id: string, payload: Partial<HomeBannerPayload>): Observable<ApiHomeBanner> {
    return this.http
      .patch<ApiHomeBanner>(`${this.baseUrl}/${id}`, payload)
      .pipe(tap((row) => this.banners.update((rows) => rows.map((r) => (r.id === id ? row : r)))));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.banners.update((rows) => rows.filter((r) => r.id !== id))));
  }
}
