import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeApiService, MyEvent } from '../../../core/services/me-api.service';

interface NextEventRow extends MyEvent {
  day: string;
  mon: string;
  time: string;
}

function formatTimeRange(startAt: string, endAt: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${new Date(startAt).toLocaleTimeString('en-US', opts)} – ${new Date(endAt).toLocaleTimeString('en-US', opts)}`;
}

@Component({
  selector: 'app-my-dashboard',
  imports: [RouterLink],
  templateUrl: './my-dashboard.html',
  styleUrl: './my-dashboard.scss',
})
export class MyDashboard {
  private readonly api = inject(MeApiService);

  constructor() {
    this.api.loadAll();
  }

  readonly upcomingRsvpCount = computed(
    () => this.api.events().filter((ev) => ev.rsvpStatus !== 'cancel' && new Date(ev.startAt) >= new Date()).length,
  );

  readonly coursesInProgress = computed(() => this.api.enrollments().filter((e) => e.status === 'enrolled').length);

  readonly certificatesEarned = computed(() => this.api.certificates().length);
  readonly donationsCount = computed(() => this.api.donations().length);

  readonly nextEvents = computed<NextEventRow[]>(() => {
    const now = new Date();
    return this.api
      .events()
      .filter((ev) => ev.rsvpStatus !== 'cancel' && new Date(ev.startAt) >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 3)
      .map((ev) => {
        const start = new Date(ev.startAt);
        return {
          ...ev,
          day: start.toLocaleDateString('en-US', { day: '2-digit' }),
          mon: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
          time: formatTimeRange(ev.startAt, ev.endAt),
        };
      });
  });
}
