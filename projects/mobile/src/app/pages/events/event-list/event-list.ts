import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PublicEventApiService } from '../../../core/services/public-event-api.service';
import { BranchApiService, PublicBranch } from '../../../core/services/branch-api.service';
import { PullToRefreshService } from '../../../core/services/pull-to-refresh.service';
import { RatingApiService, RatingSummary } from '../../../core/services/rating-api.service';

type FilterKey = 'upcoming' | 'live' | 'past' | 'all';
const ALL_BRANCHES = 'all';

@Component({
  selector: 'app-event-list',
  imports: [RouterLink],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  protected readonly api = inject(PublicEventApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly pullToRefresh = inject(PullToRefreshService);
  private readonly ratingApi = inject(RatingApiService);

  readonly filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'live', label: 'Live' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All events' },
  ];

  readonly filter = signal<FilterKey>('upcoming');

  readonly branches = signal<PublicBranch[]>([]);
  readonly branchFilter = signal<string>(ALL_BRANCHES);

  readonly events = computed(() => {
    const f = this.filter();
    const branch = this.branchFilter();
    return this.api
      .events()
      .filter((ev) => (f === 'all' || ev.when === f) && (branch === ALL_BRANCHES || ev.branchId === branch));
  });

  readonly ratings = signal<Record<string, RatingSummary>>({});

  ratingFor(eventId: string): RatingSummary {
    return this.ratings()[eventId] ?? { average: 0, count: 0 };
  }

  private refreshRatings(): void {
    this.ratingApi.bulkSummary('event', this.api.events().map((e) => e.id)).subscribe((s) => this.ratings.set(s));
  }

  constructor() {
    this.api.load().subscribe(() => this.refreshRatings());
    this.branchApi.load().subscribe((rows) => this.branches.set(rows));

    this.pullToRefresh.register(() => firstValueFrom(this.api.load()).then(() => this.refreshRatings()));
    inject(DestroyRef).onDestroy(() => this.pullToRefresh.clear());
  }

  setFilter(key: FilterKey): void {
    this.filter.set(key);
  }

  setBranchFilter(branchId: string): void {
    this.branchFilter.set(branchId);
  }
}
