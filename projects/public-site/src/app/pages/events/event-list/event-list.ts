import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicEventApiService } from '../../../core/services/public-event-api.service';
import { RatingApiService, RatingSummary } from '../../../core/services/rating-api.service';

type FilterKey = 'upcoming' | 'live' | 'past' | 'all';

@Component({
  selector: 'app-event-list',
  imports: [RouterLink],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  private readonly api = inject(PublicEventApiService);
  private readonly ratingApi = inject(RatingApiService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'live', label: 'Live' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All events' },
  ];

  readonly filter = signal<FilterKey>('upcoming');

  readonly events = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.api.events() : this.api.events().filter((ev) => ev.when === f);
  });

  readonly ratings = signal<Record<string, RatingSummary>>({});

  ratingFor(eventId: string): RatingSummary {
    return this.ratings()[eventId] ?? { average: 0, count: 0 };
  }

  ratingStarsArray(average: number): boolean[] {
    const filled = Math.round(average);
    return [1, 2, 3, 4, 5].map((n) => n <= filled);
  }

  constructor() {
    this.api.load().subscribe((rows) => {
      this.ratingApi.bulkSummary('event', rows.map((r) => r.id)).subscribe((s) => this.ratings.set(s));
    });
  }

  setFilter(key: FilterKey): void {
    this.filter.set(key);
  }
}
