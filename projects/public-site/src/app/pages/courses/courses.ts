import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PublicCourseApiService,
  PublicCourseOfferingCard,
  formatSchedule,
} from '../../core/services/public-course-api.service';
import { RatingApiService, RatingSummary } from '../../core/services/rating-api.service';

export interface CourseGroup {
  courseId: string;
  title: string;
  level: string;
  img: string;
  prerequisiteTitles: string[];
  /** Every offering (branch/date) of this course, sorted soonest-first. */
  offerings: PublicCourseOfferingCard[];
}

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

  /** One offering row per card, its own separate expander. */
  readonly expandedCourseId = signal<string | null>(null);

  readonly courseGroups = computed<CourseGroup[]>(() => {
    const byCourse = new Map<string, CourseGroup>();
    for (const o of this.offerings()) {
      let group = byCourse.get(o.courseId);
      if (!group) {
        group = { courseId: o.courseId, title: o.title, level: o.level, img: o.img, prerequisiteTitles: o.prerequisiteTitles, offerings: [] };
        byCourse.set(o.courseId, group);
      }
      group.offerings.push(o);
    }
    for (const group of byCourse.values()) {
      group.offerings.sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return [...byCourse.values()];
  });

  toggleGroup(courseId: string): void {
    this.expandedCourseId.set(this.expandedCourseId() === courseId ? null : courseId);
  }

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
