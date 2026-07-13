import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiEventStatus = 'draft' | 'published' | 'closed';

export interface ApiEvent {
  id: string;
  branchId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  location: string | null;
  capacity: number | null;
  startAt: string;
  endAt: string;
  rsvpCutoffAt: string | null;
  publishAt: string | null;
  status: ApiEventStatus;
  going: number;
  maybe: number;
  cancel: number;
  waitlist: number;
}

export interface EventPayload {
  title: string;
  branchId: string;
  description?: string;
  location?: string;
  capacity?: number;
  startAt: string;
  endAt: string;
  rsvpCutoffAt?: string;
  publishAt?: string;
  coverImage?: string;
  status?: ApiEventStatus;
}

@Injectable({ providedIn: 'root' })
export class EventApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/events`;

  readonly events = signal<ApiEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiEvent[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.events.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load events.');
          this.loading.set(false);
        },
      }),
    );
  }

  getOne(id: string) {
    return this.http.get<ApiEvent>(`${this.baseUrl}/${id}`);
  }

  create(payload: EventPayload) {
    return this.http.post<Partial<ApiEvent>>(this.baseUrl, payload).pipe(
      tap((event) => {
        const withCounts: ApiEvent = { going: 0, maybe: 0, cancel: 0, waitlist: 0, ...event } as ApiEvent;
        this.events.update((list) => [...list, withCounts]);
      }),
    );
  }

  update(id: string, payload: Partial<EventPayload>) {
    return this.http.patch<ApiEvent>(`${this.baseUrl}/${id}`, payload).pipe(
      tap((event) => this.events.update((list) => list.map((e) => (e.id === id ? { ...e, ...event } : e)))),
    );
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.events.update((list) => list.filter((e) => e.id !== id))),
    );
  }
}
