import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiEventNeedType = 'money' | 'goods';

export interface ApiEventNeed {
  id: string;
  eventId: string;
  title: string;
  type: ApiEventNeedType;
  unit: string | null;
  targetQuantity: string;
  receivedQuantity: string;
}

export interface EventNeedPayload {
  title: string;
  type: ApiEventNeedType;
  unit?: string;
  targetQuantity: number;
}

@Injectable({ providedIn: 'root' })
export class EventNeedApiService {
  private readonly http = inject(HttpClient);

  readonly needs = signal<ApiEventNeed[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  private baseUrl(eventId: string): string {
    return `${environment.apiUrl}/events/${eventId}/needs`;
  }

  load(eventId: string) {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiEventNeed[]>(this.baseUrl(eventId)).pipe(
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

  create(eventId: string, payload: EventNeedPayload) {
    return this.http
      .post<ApiEventNeed>(this.baseUrl(eventId), payload)
      .pipe(tap(() => this.load(eventId).subscribe()));
  }

  update(eventId: string, id: string, payload: Partial<EventNeedPayload>) {
    return this.http
      .patch<ApiEventNeed>(`${this.baseUrl(eventId)}/${id}`, payload)
      .pipe(tap(() => this.load(eventId).subscribe()));
  }

  remove(eventId: string, id: string) {
    return this.http
      .delete<void>(`${this.baseUrl(eventId)}/${id}`)
      .pipe(tap(() => this.needs.update((list) => list.filter((n) => n.id !== id))));
  }
}
