import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PublicCourseApiService,
  PublicCourseOfferingCard,
  formatSchedule,
} from '../../core/services/public-course-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { RatingApiService, RatingSummary } from '../../core/services/rating-api.service';
import { AuthService } from '../../core/services/auth.service';
import { MeApiService } from '../../core/services/me-api.service';

type StatusFilterKey = 'all' | 'open' | 'completed';
const ALL_BRANCHES = 'all';

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
  private readonly branchApi = inject(BranchApiService);
  private readonly ratingApi = inject(RatingApiService);
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);

  readonly offerings = signal<PublicCourseOfferingCard[]>([]);
  readonly formatSchedule = formatSchedule;
  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly statusFilterOptions: { key: StatusFilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open for enrollment' },
    { key: 'completed', label: 'Completed' },
  ];
  readonly statusFilter = signal<StatusFilterKey>('all');

  readonly branches = this.branchApi.branches;
  readonly branchFilter = signal<string>(ALL_BRANCHES);

  private readonly filteredOfferings = computed(() => {
    const status = this.statusFilter();
    const branch = this.branchFilter();
    return this.offerings().filter((o) => {
      if (branch !== ALL_BRANCHES && o.branchId !== branch) return false;
      if (status === 'open' && !o.isOpenForEnrollment) return false;
      if (status === 'completed' && o.status !== 'completed') return false;
      return true;
    });
  });

  /** Titles of courses the current student has a completed enrollment in, for the prerequisite
   * pill on course cards — mirrors course-detail.ts's prerequisitesMet(). */
  private readonly completedCourseTitles = computed(
    () => new Set(this.meApi.enrollments().filter((e) => e.status === 'completed').map((e) => e.courseTitle)),
  );
  prerequisitesMet(required: string[]): boolean {
    if (!required.length) return true;
    const completed = this.completedCourseTitles();
    return required.every((t) => completed.has(t));
  }

  readonly ratings = signal<Record<string, RatingSummary>>({});

  /** One offering row per card, its own separate expander. */
  readonly expandedCourseId = signal<string | null>(null);

  readonly courseGroups = computed<CourseGroup[]>(() => {
    const byCourse = new Map<string, CourseGroup>();
    for (const o of this.filteredOfferings()) {
      let group = byCourse.get(o.courseId);
      if (!group) {
        group = { courseId: o.courseId, title: o.title, level: o.level, img: o.img, prerequisiteTitles: o.prerequisiteTitles, offerings: [] };
        byCourse.set(o.courseId, group);
      }
      group.offerings.push(o);
    }
    for (const group of byCourse.values()) {
      // Completed offerings trail behind so the card's featured offering (offerings[0]) is
      // the soonest one still relevant, not a stale finished run — mirrors how events push
      // "past" ones to the back instead of hiding them.
      group.offerings.sort(
        (a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || a.startDate.localeCompare(b.startDate),
      );
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
    if (this.auth.isLoggedIn()) this.meApi.loadEnrollments().subscribe();
    this.api.loadAllOfferings().subscribe((rows) => {
      this.offerings.set(rows);
      this.ratingApi.bulkSummary('offering', rows.map((o) => o.offeringId)).subscribe((s) => this.ratings.set(s));
    });
    this.branchApi.load().subscribe();
  }

  setStatusFilter(key: StatusFilterKey): void {
    this.statusFilter.set(key);
  }

  setBranchFilter(branchId: string): void {
    this.branchFilter.set(branchId);
  }
}
