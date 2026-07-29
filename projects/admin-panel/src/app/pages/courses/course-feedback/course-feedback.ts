import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { ApiCourse, CourseApiService } from '../../../core/services/course-api.service';
import { ApiOffering, OfferingApiService } from '../../../core/services/offering-api.service';
import { AdminRatingRow, RatingApiService } from '../../../core/services/rating-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateFull } from '../../../core/date-time.util';

interface FeedbackRow extends AdminRatingRow {
  offeringLabel: string;
}

@Component({
  selector: 'app-course-feedback',
  imports: [],
  templateUrl: './course-feedback.html',
  styleUrl: './course-feedback.scss',
})
export class CourseFeedback {
  private readonly courseApi = inject(CourseApiService);
  private readonly offeringApi = inject(OfferingApiService);
  private readonly ratingApi = inject(RatingApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly rows = signal<FeedbackRow[]>([]);

  private readonly courseId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });

  readonly course = signal<ApiCourse | null>(null);

  readonly average = computed(() => {
    const r = this.rows();
    return r.length ? Math.round((r.reduce((sum, x) => sum + x.stars, 0) / r.length) * 10) / 10 : 0;
  });

  readonly starBreakdown = computed(() => {
    const r = this.rows();
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: r.filter((x) => x.stars === stars).length,
      pct: r.length ? Math.round((r.filter((x) => x.stars === stars).length / r.length) * 100) : 0,
    }));
  });

  formatDate(iso: string): string {
    return formatDateFull(new Date(iso));
  }

  private offeringLabel(o: ApiOffering): string {
    return `${o.branchName} · ${o.mode} · ${o.startDate}`;
  }

  constructor() {
    const id = this.courseId();
    if (!id) return;

    this.courseApi.getOne(id).subscribe({
      next: (c) => this.course.set(c),
      error: (err) => this.showError(err, 'Failed to load course.'),
    });

    this.offeringApi.load().subscribe(() => {
      const offerings = this.offeringApi.offerings().filter((o) => o.courseId === id);
      if (!offerings.length) {
        this.loading.set(false);
        return;
      }
      forkJoin(
        offerings.map((o) =>
          this.ratingApi.offeringRatings(o.id).pipe(
            map((rows) => rows.map((r) => ({ ...r, offeringLabel: this.offeringLabel(o) }))),
          ),
        ),
      ).subscribe({
        next: (grouped) => {
          const all = grouped.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.rows.set(all);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.showError(err, 'Failed to load feedback.');
        },
      });
    });
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goCourses(): void {
    this.router.navigate(['/courses']);
  }
}
