import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { MeApiService } from '../../../core/services/me-api.service';
import { PublicCourseApiService, PublicCourseOfferingCard } from '../../../core/services/public-course-api.service';
import { PullToRefreshService } from '../../../core/services/pull-to-refresh.service';
import { RatingApiService, RatingSummary } from '../../../core/services/rating-api.service';

export interface CourseGroup {
  courseId: string;
  title: string;
  img: string;
  prerequisiteTitles: string[];
  /** Every offering (branch/date) of this course, sorted soonest-first. */
  offerings: PublicCourseOfferingCard[];
}

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
  protected readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);

  readonly loading = signal(false);
  readonly offerings = signal<PublicCourseOfferingCard[]>([]);
  readonly ratings = signal<Record<string, RatingSummary>>({});

  /** Titles of courses the current student has a completed enrollment in, for the prerequisite
   * badge on course cards — mirrors course-detail.ts's prerequisitesMet(). */
  private readonly completedCourseTitles = computed(
    () => new Set(this.meApi.enrollments().filter((e) => e.status === 'completed').map((e) => e.courseTitle)),
  );
  prerequisitesMet(required: string[]): boolean {
    if (!required.length) return true;
    const completed = this.completedCourseTitles();
    return required.every((t) => completed.has(t));
  }

  readonly expandedCourseId = signal<string | null>(null);

  readonly courseGroups = computed<CourseGroup[]>(() => {
    const byCourse = new Map<string, CourseGroup>();
    for (const o of this.offerings()) {
      let group = byCourse.get(o.courseId);
      if (!group) {
        group = { courseId: o.courseId, title: o.title, img: o.img, prerequisiteTitles: o.prerequisiteTitles, offerings: [] };
        byCourse.set(o.courseId, group);
      }
      group.offerings.push(o);
    }
    for (const group of byCourse.values()) {
      group.offerings.sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return [...byCourse.values()];
  });

  toggleGroup(courseId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.expandedCourseId.set(this.expandedCourseId() === courseId ? null : courseId);
  }

  ratingFor(offeringId: string): RatingSummary {
    return this.ratings()[offeringId] ?? { average: 0, count: 0 };
  }

  constructor() {
    this.load();
    if (this.auth.isLoggedIn()) this.meApi.loadEnrollments().subscribe();

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
