import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ApiEvent, EventApiService } from '../../../core/services/event-api.service';
import { AdminRatingRow, RatingApiService } from '../../../core/services/rating-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateFull } from '../../../core/date-time.util';

@Component({
  selector: 'app-event-feedback',
  imports: [],
  templateUrl: './event-feedback.html',
  styleUrl: './event-feedback.scss',
})
export class EventFeedback {
  private readonly eventApi = inject(EventApiService);
  private readonly ratingApi = inject(RatingApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly rows = signal<AdminRatingRow[]>([]);

  private readonly eventId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });

  readonly event = signal<ApiEvent | null>(null);

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

  constructor() {
    const id = this.eventId();
    if (id) {
      this.event.set(this.eventApi.events().find((e) => e.id === id) ?? null);
      if (!this.event()) {
        this.eventApi.load().subscribe(() => this.event.set(this.eventApi.events().find((e) => e.id === id) ?? null));
      }
      this.ratingApi.eventRatings(id).subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.showError(err, 'Failed to load feedback.');
        },
      });
    }
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goEvents(): void {
    this.router.navigate(['/events']);
  }
}
