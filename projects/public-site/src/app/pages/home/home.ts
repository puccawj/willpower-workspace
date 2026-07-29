import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PublicEventApiService } from '../../core/services/public-event-api.service';
import { PublicCourseApiService, PublicCourseOfferingCard } from '../../core/services/public-course-api.service';
import { HomeBannerApiService } from '../../core/services/home-banner-api.service';
import { RatingApiService, RatingSummary } from '../../core/services/rating-api.service';
import { AuthService } from '../../core/services/auth.service';

const AUTO_ADVANCE_MS = 6000;

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnDestroy {
  private readonly eventsApi = inject(PublicEventApiService);
  private readonly coursesApi = inject(PublicCourseApiService);
  private readonly bannerApi = inject(HomeBannerApiService);
  private readonly ratingApi = inject(RatingApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly banners = this.bannerApi.banners;
  readonly activeSlide = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly homeEvents = computed(() =>
    this.eventsApi
      .events()
      .filter((ev) => ev.when === 'upcoming' || ev.when === 'live')
      .slice(0, 3),
  );
  readonly homeOfferings = computed(() => this.offerings().slice(0, 3));
  private readonly offerings = signal<PublicCourseOfferingCard[]>([]);

  readonly eventRatings = signal<Record<string, RatingSummary>>({});
  readonly offeringRatings = signal<Record<string, RatingSummary>>({});

  eventRatingFor(eventId: string): RatingSummary {
    return this.eventRatings()[eventId] ?? { average: 0, count: 0 };
  }

  offeringRatingFor(offeringId: string): RatingSummary {
    return this.offeringRatings()[offeringId] ?? { average: 0, count: 0 };
  }

  ratingStarsArray(average: number): boolean[] {
    const filled = Math.round(average);
    return [1, 2, 3, 4, 5].map((n) => n <= filled);
  }

  constructor() {
    this.eventsApi.load().subscribe(() => {
      const ids = this.homeEvents().map((ev) => ev.id);
      this.ratingApi.bulkSummary('event', ids).subscribe((summaries) => this.eventRatings.set(summaries));
    });
    this.coursesApi.loadAllOfferings().subscribe((rows) => {
      this.offerings.set(rows);
      const ids = this.homeOfferings().map((o) => o.offeringId);
      this.ratingApi.bulkSummary('offering', ids).subscribe((summaries) => this.offeringRatings.set(summaries));
    });
    this.bannerApi.load().subscribe(() => {
      if (this.banners().length > 1) this.timer = setInterval(() => this.next(), AUTO_ADVANCE_MS);
    });
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
  }

  next(): void {
    const total = this.banners().length;
    this.activeSlide.set((this.activeSlide() + 1) % total);
  }

  prev(): void {
    const total = this.banners().length;
    this.activeSlide.set((this.activeSlide() - 1 + total) % total);
  }

  onBannerClick(link: string | null): void {
    if (!link) return;
    if (/^https?:\/\//.test(link)) {
      window.open(link, '_blank', 'noopener');
    } else {
      this.router.navigateByUrl(link);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
