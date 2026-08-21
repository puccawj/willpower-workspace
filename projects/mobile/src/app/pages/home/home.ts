import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { HomeBannerApiService } from '../../core/services/home-banner-api.service';
import { MeApiService, MyEvent } from '../../core/services/me-api.service';
import { NotificationApiService } from '../../core/services/notification-api.service';
import { PushRegistrationService } from '../../core/services/push-registration.service';
import { PublicEventApiService } from '../../core/services/public-event-api.service';
import { PublicCourseApiService, PublicCourseOfferingCard } from '../../core/services/public-course-api.service';
import { PullToRefreshService } from '../../core/services/pull-to-refresh.service';
import { RatingApiService, RatingSummary } from '../../core/services/rating-api.service';
import { ImageViewerService } from '../../core/services/image-viewer.service';

const AUTO_ADVANCE_MS = 6000;
const SWIPE_THRESHOLD_PX = 40;

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);
  private readonly publicEvents = inject(PublicEventApiService);
  private readonly publicCourses = inject(PublicCourseApiService);
  private readonly bannerApi = inject(HomeBannerApiService);
  private readonly pullToRefresh = inject(PullToRefreshService);
  protected readonly notificationApi = inject(NotificationApiService);
  private readonly pushRegistration = inject(PushRegistrationService);
  private readonly ratingApi = inject(RatingApiService);
  private readonly router = inject(Router);
  private readonly imageViewer = inject(ImageViewerService);

  readonly view = signal<'list' | 'card'>('card');
  readonly banners = this.bannerApi.banners;
  readonly activeSlide = signal(0);
  private bannerTimer: ReturnType<typeof setInterval> | null = null;

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly nextUp = computed<MyEvent | null>(() => {
    const confirmed = this.meApi
      .events()
      .filter((e) => e.rsvpStatus === 'confirm')
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return confirmed[0] ?? null;
  });

  readonly upcoming = computed(() => this.publicEvents.events().filter((e) => e.when === 'upcoming').slice(0, 6));

  readonly offerings = computed(() => this.offeringCards().slice(0, 6));
  private readonly offeringCards = signal<PublicCourseOfferingCard[]>([]);

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

  private refreshRatings(): void {
    const eventIds = this.upcoming().map((e) => e.id);
    this.ratingApi.bulkSummary('event', eventIds).subscribe((s) => this.eventRatings.set(s));
    const offeringIds = this.offerings().map((o) => o.offeringId);
    this.ratingApi.bulkSummary('offering', offeringIds).subscribe((s) => this.offeringRatings.set(s));
  }

  formatNextUpMeta(startAt: string): string {
    const d = new Date(startAt);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
  }

  nextSlide(): void {
    const total = this.banners().length;
    this.activeSlide.set((this.activeSlide() + 1) % total);
  }

  prevSlide(): void {
    const total = this.banners().length;
    this.activeSlide.set((this.activeSlide() - 1 + total) % total);
  }

  onBannerClick(link: string | null): void {
    // A drag-swipe can still fire a native click on release even though the pointer moved —
    // without this guard, dragging to the next slide could also navigate away via the slide
    // you dragged *from*.
    if (this.suppressNextBannerClick) return;
    if (!link) return;
    if (/^https?:\/\//.test(link)) {
      void Browser.open({ url: link });
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

    if (dx < 0) this.nextSlide();
    else this.prevSlide();
  }

  constructor() {
    this.meApi.loadEvents().subscribe();
    this.publicEvents.load().subscribe(() => this.refreshRatings());
    this.publicCourses.loadAllOfferings().subscribe((rows) => {
      this.offeringCards.set(rows);
      this.refreshRatings();
    });
    this.notificationApi.loadUnreadCount().subscribe();
    void this.pushRegistration.init();
    this.bannerApi.load().subscribe(() => {
      if (this.banners().length > 1) this.bannerTimer = setInterval(() => this.nextSlide(), AUTO_ADVANCE_MS);
    });

    this.pullToRefresh.register(() =>
      Promise.all([
        firstValueFrom(this.meApi.loadEvents()),
        firstValueFrom(this.publicEvents.load()),
        firstValueFrom(this.publicCourses.loadAllOfferings()).then((rows) => this.offeringCards.set(rows)),
        firstValueFrom(this.bannerApi.load()),
      ]).then(() => this.refreshRatings()),
    );
    inject(DestroyRef).onDestroy(() => {
      this.pullToRefresh.clear();
      if (this.bannerTimer) clearInterval(this.bannerTimer);
    });
  }
}
