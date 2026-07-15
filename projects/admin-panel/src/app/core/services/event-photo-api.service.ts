import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiEventPhoto {
  id: string;
  eventId: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

export interface EventPhotoPayload {
  imageUrl: string;
  caption?: string;
}

@Injectable({ providedIn: 'root' })
export class EventPhotoApiService {
  private readonly http = inject(HttpClient);

  readonly photos = signal<ApiEventPhoto[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  private baseUrl(eventId: string): string {
    return `${environment.apiUrl}/events/${eventId}/photos`;
  }

  load(eventId: string) {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiEventPhoto[]>(this.baseUrl(eventId)).pipe(
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

  create(eventId: string, payload: EventPhotoPayload) {
    return this.http
      .post<ApiEventPhoto>(this.baseUrl(eventId), payload)
      .pipe(tap(() => this.load(eventId).subscribe()));
  }

  update(eventId: string, id: string, payload: Partial<EventPhotoPayload>) {
    return this.http
      .patch<ApiEventPhoto>(`${this.baseUrl(eventId)}/${id}`, payload)
      .pipe(tap(() => this.load(eventId).subscribe()));
  }

  remove(eventId: string, id: string) {
    return this.http
      .delete<void>(`${this.baseUrl(eventId)}/${id}`)
      .pipe(tap(() => this.photos.update((list) => list.filter((p) => p.id !== id))));
  }
}
