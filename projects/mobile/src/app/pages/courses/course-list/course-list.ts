import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PublicCourseApiService, PublicCourseOfferingCard } from '../../../core/services/public-course-api.service';
import { PullToRefreshService } from '../../../core/services/pull-to-refresh.service';
import { RatingApiService, RatingSummary } from '../../../core/services/rating-api.service';

@Component({
  selector: 'app-course-list',
  imports: [RouterLink],
  templateUrl: './course-list.html',
  styleUrl: './course-list.scss',
})
export class CourseList {
  private readonly api = inject(PublicCourseApiService);
  private readonly pullToRefresh = inject(PullToRefreshService);
  private readonly ratingApi = inject(RatingApiService);

  readonly loading = signal(false);
  readonly offerings = signal<PublicCourseOfferingCard[]>([]);
  readonly ratings = signal<Record<string, RatingSummary>>({});

  ratingFor(offeringId: string): RatingSummary {
    return this.ratings()[offeringId] ?? { average: 0, count: 0 };
  }

  constructor() {
    this.load();

    this.pullToRefresh.register(() => this.load());
    inject(DestroyRef).onDestroy(() => this.pullToRefresh.clear());
  }

  private load(): Promise<void> {
    this.loading.set(true);
    return firstValueFrom(this.api.loadAllOfferings()).then((rows) => {
      this.offerings.set(rows);
      this.loading.set(false);
      this.ratingApi.bulkSummary('offering', rows.map((o) => o.offeringId)).subscribe((s) => this.ratings.set(s));
    });
  }
}
