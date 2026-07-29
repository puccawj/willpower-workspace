import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PublicCourseApiService,
  PublicCourseOfferingCard,
  formatSchedule,
} from '../../core/services/public-course-api.service';
import { RatingApiService, RatingSummary } from '../../core/services/rating-api.service';

@Component({
  selector: 'app-courses',
  imports: [RouterLink],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class Courses {
  private readonly api = inject(PublicCourseApiService);
  private readonly ratingApi = inject(RatingApiService);

  readonly offerings = signal<PublicCourseOfferingCard[]>([]);
  readonly formatSchedule = formatSchedule;

  readonly ratings = signal<Record<string, RatingSummary>>({});

  ratingFor(offeringId: string): RatingSummary {
    return this.ratings()[offeringId] ?? { average: 0, count: 0 };
  }

  ratingStarsArray(average: number): boolean[] {
    const filled = Math.round(average);
    return [1, 2, 3, 4, 5].map((n) => n <= filled);
  }

  constructor() {
    this.api.loadAllOfferings().subscribe((rows) => {
      this.offerings.set(rows);
      this.ratingApi.bulkSummary('offering', rows.map((o) => o.offeringId)).subscribe((s) => this.ratings.set(s));
    });
  }
}
