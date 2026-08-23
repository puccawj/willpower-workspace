import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PublicEventApiService } from '../../core/services/public-event-api.service';
import { PublicEvent } from '../../core/models/public-event.models';
import { PublicCourseApiService, PublicCourseOfferingCard } from '../../core/services/public-course-api.service';
import { HomeBannerApiService } from '../../core/services/home-banner-api.service';
import { RatingApiService, RatingSummary } from '../../core/services/rating-api.service';
import { AuthService } from '../../core/services/auth.service';
import { SiteContentApiService } from '../../core/services/site-content-api.service';
import { ImageViewerService } from '../../core/services/image-viewer.service';

const AUTO_ADVANCE_MS = 6000;
const SWIPE_THRESHOLD_PX = 40;

export interface HomeHeroContent {
  eyebrow: string;
  headingLine1: string;
  headingLine2: string;
  description: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  stat3Value: string;
  stat3Label: string;
}

const DEFAULT_HERO: HomeHeroContent = {
  eyebrow: 'Established 1932 · USA · Canada · Australia',
  headingLine1: 'Training the mind,',
  headingLine2: 'strengthening the will',
  description:
    'A center for meditation and contemplative study, guiding students toward clarity, discipline, and inner strength through timeless practice.',
  stat1Value: '3',
  stat1Label: 'Branches',
  stat2Value: '12,000+',
  stat2Label: 'Students',
  stat3Value: '90+',
  stat3Label: 'Years',
};

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
  private readonly siteContentApi = inject(SiteContentApiService);
  private readonly imageViewer = inject(ImageViewerService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly hero = signal<HomeHeroContent>({ ...DEFAULT_HERO });
  readonly banners = this.bannerApi.banners;
  readonly activeSlide = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Every event — upcoming and live shown first (most actionable), past events trail behind
   * and are rendered dimmed rather than hidden, so this doubles as a lightweight history view.
   * Capped at 10 — this is a home-page preview, "View all" leads to the full list. */
  readonly homeEvents = computed(() => {
    const priority: Record<PublicEvent['when'], number> = { live: 0, upcoming: 1, past: 2 };
    return [...this.eventsApi.events()].sort((a, b) => priority[a.when] - priority[b.when]).slice(0, 10);
  });
  readonly homeOfferings = computed(() => this.offerings().slice(0, 10));
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
    this.siteContentApi.get<Partial<HomeHeroContent>>('home-hero').subscribe({
      next: (content) => this.hero.set({ ...DEFAULT_HERO, ...content }),
      error: () => this.hero.set(DEFAULT_HERO),
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
    // A mouse-drag swipe still fires a native click on mouseup even though the pointer moved —
    // touch mostly suppresses this on its own, but desktop mouse doesn't, so without this guard
    // dragging to the next slide could also navigate away via the slide you dragged *from*.
    if (this.suppressNextBannerClick) return;
    if (!link) return;
    if (/^https?:\/\//.test(link)) {
      window.open(link, '_blank', 'noopener');
    } else {
      this.router.navigateByUrl(link);
    }
  }

  openZoom(event: Event, imageUrl: string): void {
    event.stopPropagation();
    this.imageViewer.open(imageUrl);
  }

  // ---- Swipe left/right between banners ----

  private swipeStartX = 0;
  private swipeStartY = 0;
  private swiping = false;
  private suppressNextBannerClick = false;

  onCarouselPointerDown(event: PointerEvent): void {
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;
    this.swiping = true;
  }

  onCarouselPointerUp(event: PointerEvent): void {
    if (!this.swiping) return;
    this.swiping = false;
    if (this.banners().length < 2) return;

    const dx = event.clientX - this.swipeStartX;
    const dy = event.clientY - this.swipeStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;

    this.suppressNextBannerClick = true;
    setTimeout(() => (this.suppressNextBannerClick = false), 0);

    if (dx < 0) this.next();
    else this.prev();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
