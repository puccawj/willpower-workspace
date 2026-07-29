import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MeApiService, MyEvent } from '../../core/services/me-api.service';
import { NotificationApiService } from '../../core/services/notification-api.service';
import { PushRegistrationService } from '../../core/services/push-registration.service';
import { PublicEventApiService } from '../../core/services/public-event-api.service';
import { PublicCourseApiService, PublicCourseOfferingCard } from '../../core/services/public-course-api.service';
import { PullToRefreshService } from '../../core/services/pull-to-refresh.service';
import { RatingApiService, RatingSummary } from '../../core/services/rating-api.service';

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
  private readonly pullToRefresh = inject(PullToRefreshService);
  protected readonly notificationApi = inject(NotificationApiService);
  private readonly pushRegistration = inject(PushRegistrationService);
  private readonly ratingApi = inject(RatingApiService);

  readonly view = signal<'list' | 'card'>('card');

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

  constructor() {
    this.meApi.loadEvents().subscribe();
    this.publicEvents.load().subscribe(() => this.refreshRatings());
    this.publicCourses.loadAllOfferings().subscribe((rows) => {
      this.offeringCards.set(rows);
      this.refreshRatings();
    });
    this.notificationApi.loadUnreadCount().subscribe();
    void this.pushRegistration.init();

    this.pullToRefresh.register(() =>
      Promise.all([
        firstValueFrom(this.meApi.loadEvents()),
        firstValueFrom(this.publicEvents.load()),
        firstValueFrom(this.publicCourses.loadAllOfferings()).then((rows) => this.offeringCards.set(rows)),
      ]).then(() => this.refreshRatings()),
    );
    inject(DestroyRef).onDestroy(() => this.pullToRefresh.clear());
  }
}
