import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicEventApiService } from '../../../core/services/public-event-api.service';
import { BranchApiService } from '../../../core/services/branch-api.service';
import { RatingApiService, RatingSummary } from '../../../core/services/rating-api.service';
import { branchColorClass } from '../../../core/branch-color.util';

type FilterKey = 'upcoming' | 'live' | 'past' | 'all';
const ALL_BRANCHES = 'all';

@Component({
  selector: 'app-event-list',
  imports: [RouterLink],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  private readonly api = inject(PublicEventApiService);
  private readonly branchApi = inject(BranchApiService);
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

  readonly branches = this.branchApi.branches;
  readonly branchFilter = signal<string>(ALL_BRANCHES);

  readonly events = computed(() => {
    const f = this.filter();
    const branch = this.branchFilter();
    return this.api
      .events()
      .filter((ev) => (f === 'all' || ev.when === f) && (branch === ALL_BRANCHES || ev.branchId === branch));
  });

  readonly ratings = signal<Record<string, RatingSummary>>({});
  readonly branchClass = branchColorClass;

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
    this.branchApi.load().subscribe();
  }

  setFilter(key: FilterKey): void {
    this.filter.set(key);
  }

  setBranchFilter(branchId: string): void {
    this.branchFilter.set(branchId);
  }
}
