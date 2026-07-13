import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeApiService, MyEvent } from '../../../core/services/me-api.service';

interface MyEventRow extends MyEvent {
  day: string;
  mon: string;
  dateFull: string;
}

function toRow(ev: MyEvent): MyEventRow {
  const start = new Date(ev.startAt);
  return {
    ...ev,
    day: start.toLocaleDateString('en-US', { day: '2-digit' }),
    mon: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    dateFull: start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

@Component({
  selector: 'app-my-events',
  imports: [RouterLink],
  templateUrl: './my-events.html',
  styleUrl: './my-events.scss',
})
export class MyEvents {
  private readonly api = inject(MeApiService);

  readonly loading = this.api.loading;
  readonly rows = computed<MyEventRow[]>(() =>
    [...this.api.events()].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).map(toRow),
  );

  constructor() {
    this.api.loadEvents().subscribe();
  }

  cancel(eventId: string): void {
    this.api.setRsvp(eventId, 'cancel').subscribe();
  }
}
