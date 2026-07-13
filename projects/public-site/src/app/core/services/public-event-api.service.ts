import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PublicEvent } from '../models/public-event.models';

interface ApiPublicEventRow {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  location: string | null;
  capacity: number | null;
  startAt: string;
  endAt: string;
  rsvpCutoffAt: string | null;
  branchId: string;
  branchName: string;
  branchCity: string | null;
  going: number;
}

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?q=80&w=1200&auto=format&fit=crop';

function formatTimeRange(startAt: string, endAt: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${new Date(startAt).toLocaleTimeString('en-US', opts)} – ${new Date(endAt).toLocaleTimeString('en-US', opts)}`;
}

function classifyWhen(startAt: string, endAt: string): PublicEvent['when'] {
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'past';
}

function toPublicEvent(row: ApiPublicEventRow): PublicEvent {
  const start = new Date(row.startAt);
  const blurb = row.description ?? 'Details for this event will be shared soon.';
  return {
    id: row.id,
    img: row.coverImageUrl ?? FALLBACK_IMG,
    day: start.toLocaleDateString('en-US', { day: '2-digit' }),
    mon: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    dateFull: start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    when: classifyWhen(row.startAt, row.endAt),
    branchId: row.branchId,
    branch: row.branchName,
    rsvpCutoffAt: row.rsvpCutoffAt,
    title: row.title,
    blurb,
    time: formatTimeRange(row.startAt, row.endAt),
    location: [row.location, row.branchCity].filter(Boolean).join(', '),
    capacity: row.capacity ?? 0,
    going: row.going,
    body1: blurb,
    body2: '',
  };
}

@Injectable({ providedIn: 'root' })
export class PublicEventApiService {
  private readonly http = inject(HttpClient);

  readonly events = signal<PublicEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load(): Observable<PublicEvent[]> {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiPublicEventRow[]>(`${environment.apiUrl}/public/events`).pipe(
      map((rows) => rows.map(toPublicEvent)),
      tap({
        next: (events) => {
          this.events.set(events);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load events right now.');
          this.loading.set(false);
        },
      }),
    );
  }

  loadOne(id: string): Observable<PublicEvent> {
    return this.http
      .get<ApiPublicEventRow>(`${environment.apiUrl}/public/events/${id}`)
      .pipe(map(toPublicEvent));
  }
}
