import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import {
  PublicCourseApiService,
  PublicCourseDetail,
  PublicCourseNeed,
  PublicCoursePhoto,
  PublicDonationRow,
  PublicOffering,
  formatSchedule,
  shortDate,
} from '../../../core/services/public-course-api.service';
import { MeApiService } from '../../../core/services/me-api.service';
import { RatingApiService, RatingSummary } from '../../../core/services/rating-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { ImageViewerService } from '../../../core/services/image-viewer.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-course-detail',
  imports: [RouterLink, FormsModule, DatePipe, BackButton],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicCourseApiService);
  private readonly meApi = inject(MeApiService);
  private readonly ratingApi = inject(RatingApiService);
  private readonly auth = inject(AuthService);
  private readonly uploads = inject(UploadApiService);
  private readonly imageViewer = inject(ImageViewerService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  /** Which offering the visitor arrived to view (via Home/Courses list) — null shows every offering. */
  readonly targetOfferingId = this.route.snapshot.queryParamMap.get('offering');
  readonly course = signal<PublicCourseDetail | null>(null);
  readonly offerings = signal<PublicOffering[]>([]);
  readonly offeringsLoading = signal(false);
  readonly offeringsError = signal('');
  readonly enrollingOfferingId = signal<string | null>(null);
  readonly enrollError = signal('');
  readonly expandedOfferingId = signal<string | null>(null);

  readonly formatSchedule = formatSchedule;
  readonly shortDate = shortDate;

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly isStudent = computed(() => this.auth.currentUser()?.role === 'student');

  /** Only the offering the visitor arrived to view, if any — otherwise every open offering. */
  readonly visibleOfferings = computed(() => {
    const target = this.targetOfferingId;
    if (!target) return this.offerings();
    const match = this.offerings().filter((o) => o.id === target);
    return match.length ? match : this.offerings();
  });

  /** Fallback branch for whole-course (no specific offering) needs/general donations. */
  private readonly donationBranchId = computed(() => this.offerings()[0]?.branchId ?? null);

  readonly enrolledOfferingIds = computed(
    () => new Set(this.meApi.enrollments().map((e) => e.offeringId)),
  );

  // Matches by offering id, not just "did we just enroll this session" — so a returning
  // visit to an already-enrolled course shows the right state, same pattern as
  // EventDetail's rsvpStatus computed from MeApiService.events().
  readonly myEnrollment = computed(
    () => this.meApi.enrollments().find((e) => this.offerings().some((o) => o.id === e.offeringId)) ?? null,
  );

  /** First session date for the offering behind the current enrollment — drives the persistent "you're enrolled" banner. */
  readonly myEnrollmentFirstSessionDate = computed(() => {
    const enrollment = this.myEnrollment();
    if (!enrollment) return null;
    const offering = this.offerings().find((o) => o.id === enrollment.offeringId);
    return offering ? this.shortDate(offering.startDate) : null;
  });

  offeringEnded(offering: PublicOffering): boolean {
    const end = new Date(offering.endDate);
    end.setHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
  }

  toggleOfferingDetails(offeringId: string): void {
    this.expandedOfferingId.set(this.expandedOfferingId() === offeringId ? null : offeringId);
  }

  // ---- Atmosphere photos ----

  readonly photos = signal<PublicCoursePhoto[]>([]);

  openPhoto(photo: PublicCoursePhoto): void {
    this.imageViewer.open(photo.imageUrl);
  }

  // ---- Star rating (per offering) ----

  readonly ratingSummaries = signal<Map<string, RatingSummary>>(new Map());
  readonly myRatingIds = signal<Map<string, string>>(new Map());
  readonly myStarsByOffering = signal<Map<string, number>>(new Map());
  readonly myNotesByOffering = signal<Map<string, string>>(new Map());
  readonly ratingSavingOfferingId = signal<string | null>(null);
  readonly ratingSavedOfferingId = signal<string | null>(null);

  readonly ratingStars = [1, 2, 3, 4, 5];

  ratingSummaryFor(offeringId: string): RatingSummary {
    return this.ratingSummaries().get(offeringId) ?? { average: 0, count: 0 };
  }

  filledStarsFor(offeringId: string): number {
    return Math.round(this.ratingSummaryFor(offeringId).average);
  }

  myStarsFor(offeringId: string): number {
    return this.myStarsByOffering().get(offeringId) ?? 0;
  }

  myNoteFor(offeringId: string): string {
    return this.myNotesByOffering().get(offeringId) ?? '';
  }

  setMyStars(offeringId: string, n: number): void {
    this.myStarsByOffering.update((m) => new Map(m).set(offeringId, n));
  }

  setMyNote(offeringId: string, note: string): void {
    this.myNotesByOffering.update((m) => new Map(m).set(offeringId, note));
  }

  submitOfferingRating(offeringId: string): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/courses/${this.courseId}` } });
      return;
    }
    const stars = this.myStarsFor(offeringId);
    if (!stars) return;

    this.ratingSavingOfferingId.set(offeringId);
    this.ratingSavedOfferingId.set(null);
    this.meApi.rateOffering(offeringId, stars, this.myNoteFor(offeringId).trim() || undefined).subscribe({
      next: (row) => {
        this.myRatingIds.update((m) => new Map(m).set(offeringId, row.id));
        this.ratingSavingOfferingId.set(null);
        this.ratingSavedOfferingId.set(offeringId);
        this.ratingApi.summary('offering', offeringId).subscribe((s) => this.ratingSummaries.update((m) => new Map(m).set(offeringId, s)));
      },
      error: () => {
        this.ratingSavingOfferingId.set(null);
      },
    });
  }

  // ---- Donation wishlist (needs), scoped per offering + whole course ----

  readonly needs = signal<PublicCourseNeed[]>([]);
  readonly donations = signal<PublicDonationRow[]>([]);

  donationsForOffering(offeringId: string): PublicDonationRow[] {
    return this.donations().filter((d) => d.offeringId === offeringId);
  }

  readonly needsByOffering = computed(() => {
    const map = new Map<string, PublicCourseNeed[]>();
    for (const n of this.needs()) {
      if (!n.offeringId) continue;
      const list = map.get(n.offeringId) ?? [];
      list.push(n);
      map.set(n.offeringId, list);
    }
    return map;
  });

  needsForOffering(offeringId: string): PublicCourseNeed[] {
    return this.needsByOffering().get(offeringId) ?? [];
  }

  readonly needProgress = (need: PublicCourseNeed) => {
    const target = Number(need.targetQuantity);
    const received = Number(need.receivedQuantity);
    const pct = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : 0;
    const unitLabel = need.type === 'money' ? 'USD' : (need.unit ?? '');
    return { pct, label: `${received.toLocaleString()} / ${target.toLocaleString()} ${unitLabel}`.trim() };
  };

  readonly formatMoney = (value: string | null): string => {
    const n = Number(value ?? 0);
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  readonly donateOptions: { key: 'money' | 'goods'; label: string }[] = [
    { key: 'money', label: 'Funds' },
    { key: 'goods', label: 'Goods' },
  ];

  readonly donateType = signal<'money' | 'goods'>('money');

  /** null = no donate form open; 'general:<offeringId>' = untargeted donation to that offering; otherwise a CourseNeed id. */
  readonly activeTarget = signal<string | null>(null);
  readonly activeNeed = computed(() => {
    const t = this.activeTarget();
    return t && !t.startsWith('general:') ? this.needs().find((n) => n.id === t) ?? null : null;
  });

  /** The offering a general-donation target refers to. */
  private readonly generalTargetOffering = computed<PublicOffering | null>(() => {
    const t = this.activeTarget();
    if (!t?.startsWith('general:')) return null;
    const offeringId = t.slice('general:'.length);
    return this.offerings().find((o) => o.id === offeringId) ?? null;
  });

  /** The offering backing the currently active target, whether via a need or a general donation. */
  readonly activeOffering = computed<PublicOffering | null>(() => {
    const need = this.activeNeed();
    if (need) return need.offeringId ? this.offerings().find((o) => o.id === need.offeringId) ?? null : null;
    return this.generalTargetOffering();
  });

  private readonly targetBranchId = computed<string | null>(() => this.activeOffering()?.branchId ?? this.donationBranchId());

  readonly donateAmount = signal('');
  readonly donatePhone = signal('');
  readonly proofFile = signal<File | null>(null);
  readonly donateThanks = signal(false);
  readonly donateSubmitting = signal(false);
  readonly donateError = signal('');

  readonly effectiveDonateType = computed(() => this.activeNeed()?.type ?? this.donateType());

  readonly isGeneralGoods = computed(() => !this.activeNeed() && this.effectiveDonateType() === 'goods');

  readonly donateUnitOptions = ['kg', 'g', 'pieces', 'bags', 'boxes', 'sets', 'liters', 'packs'];
  readonly donateItemName = signal('');
  readonly donateUnit = signal(this.donateUnitOptions[0]);

  readonly donatePlaceholder = computed(() => {
    const need = this.activeNeed();
    if (need) {
      return need.type === 'money' ? 'Amount (USD)' : `Quantity (${need.unit ?? 'units'})`;
    }
    return this.donateType() === 'money' ? 'Amount (USD)' : 'Quantity';
  });

  onDonateAmountInput(input: HTMLInputElement): void {
    const cleaned = input.value.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    const sanitized = rest.length ? `${whole}.${rest.join('')}` : whole;
    if (input.value !== sanitized) input.value = sanitized;
    this.donateAmount.set(sanitized);
  }

  constructor() {
    const targetOfferingId = this.targetOfferingId;
    if (targetOfferingId) this.expandedOfferingId.set(targetOfferingId);

    this.publicApi.loadOne(this.courseId).subscribe((c) => this.course.set(c));
    this.offeringsLoading.set(true);
    this.publicApi.loadOfferings(this.courseId).subscribe({
      next: (rows) => {
        this.offerings.set(rows);
        this.offeringsLoading.set(false);

        const offeringIds = rows.map((o) => o.id);
        this.ratingApi.bulkSummary('offering', offeringIds).subscribe((summaries) => {
          this.ratingSummaries.set(new Map(Object.entries(summaries)));
        });
        if (this.auth.isLoggedIn()) {
          for (const offeringId of offeringIds) {
            this.meApi.myOfferingRating(offeringId).subscribe((r) => {
              if (r) {
                this.myRatingIds.update((m) => new Map(m).set(offeringId, r.id));
                this.myStarsByOffering.update((m) => new Map(m).set(offeringId, r.stars));
                this.myNotesByOffering.update((m) => new Map(m).set(offeringId, r.note ?? ''));
              }
            });
          }
        }
      },
      error: () => {
        this.offeringsError.set('Could not load available class times.');
        this.offeringsLoading.set(false);
      },
    });
    this.meApi.loadEnrollments().subscribe();
    this.publicApi.loadNeeds(this.courseId).subscribe((rows) => this.needs.set(rows));
    this.publicApi.loadPhotos(this.courseId).subscribe((rows) => this.photos.set(rows));
    if (this.auth.isLoggedIn()) {
      this.refreshDonations();
    }
  }

  private refreshDonations(): void {
    this.publicApi.loadDonations(this.courseId).subscribe((rows) => {
      this.donations.set([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  }

  /** Whether the current student already has a completed enrollment in every prerequisite course, by title. */
  readonly prerequisitesMet = computed(() => {
    const required = this.course()?.prerequisiteTitles ?? [];
    if (!required.length) return true;
    const completedTitles = new Set(
      this.meApi
        .enrollments()
        .filter((e) => e.status === 'completed')
        .map((e) => e.courseTitle),
    );
    return required.every((t) => completedTitles.has(t));
  });

  async enrollIn(offering: PublicOffering): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/courses/${this.courseId}` } });
      return;
    }

    const course = this.course();
    const required = course?.prerequisiteTitles ?? [];
    const prereqLine = required.length
      ? `${this.prerequisitesMet() ? '✓' : '✗'} Prerequisite${required.length > 1 ? 's' : ''}: ${required.join(', ')}`
      : '✓ No prerequisites required';

    const confirmed = await this.confirmService.ask(
      `${course?.title ?? ''}\n${offering.branchName} · ${offering.startDate} – ${offering.endDate}\n${course?.sessions ?? ''}\n${prereqLine}`,
      { title: 'Confirm your enrollment', confirmLabel: 'Enroll' },
    );
    if (!confirmed) return;

    this.enrollingOfferingId.set(offering.id);
    this.enrollError.set('');
    this.meApi.enrollSelf(offering.id).subscribe({
      next: () => {
        this.enrollingOfferingId.set(null);
        this.toast.show(`You're enrolled in ${course?.title ?? 'the course'}!`, 'success');
      },
      error: (err) => {
        this.enrollingOfferingId.set(null);
        this.enrollError.set(err?.error?.message ?? 'Could not enroll you right now.');
      },
    });
  }

  setDonateType(type: 'money' | 'goods'): void {
    this.donateType.set(type);
  }

  openDonate(target: string): void {
    const next = this.activeTarget() === target ? null : target;
    this.activeTarget.set(next);
    this.donateAmount.set('');
    this.donatePhone.set('');
    this.donateItemName.set('');
    this.donateUnit.set(this.donateUnitOptions[0]);
    this.donateError.set('');
    this.proofFile.set(null);
    this.donateThanks.set(false);
  }

  onProofFileSelected(input: HTMLInputElement): void {
    this.proofFile.set(input.files?.[0] ?? null);
  }

  submitDonate(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/courses/${this.courseId}` } });
      return;
    }

    const course = this.course();
    const user = this.auth.currentUser();
    const branchId = this.targetBranchId();
    if (!course || !user) return;

    const offering = this.activeOffering();
    if (offering && this.offeringEnded(offering)) return;

    this.donateError.set('');

    if (!branchId) {
      this.donateError.set('This course has no scheduled class offerings yet, so donations aren’t open.');
      return;
    }

    const amountText = this.donateAmount().trim();
    const isGeneralGoods = this.isGeneralGoods();
    const itemName = this.donateItemName().trim();

    if (isGeneralGoods && !itemName) {
      this.donateError.set('Please enter the name of the item.');
      return;
    }
    if (!amountText) {
      this.donateError.set(this.effectiveDonateType() === 'money' ? 'Please enter a donation amount.' : 'Please enter a quantity.');
      return;
    }
    if (!this.donatePhone().trim()) {
      this.donateError.set('Please enter a phone number.');
      return;
    }

    const need = this.activeNeed();
    const type = this.effectiveDonateType();

    this.donateSubmitting.set(true);
    const proofFile = this.proofFile();
    const proofImage$: Observable<string | undefined> = proofFile ? this.uploads.uploadFile(proofFile) : of(undefined);
    proofImage$
      .pipe(
        switchMap((proofImage) =>
          this.meApi.donate({
            donorName: user.name,
            donorEmail: user.email,
            donorPhoneNumber: this.donatePhone().trim(),
            type,
            amountOrItem:
              need && type === 'goods'
                ? `${amountText} ${need.unit ?? ''} — ${need.title}`.trim()
                : isGeneralGoods
                  ? `${amountText} ${this.donateUnit()} — ${itemName}`.trim()
                  : amountText,
            branchId,
            courseId: course.id,
            courseNeedId: need?.id,
            offeringId: offering?.id,
            quantity: type === 'goods' ? Number(amountText) : undefined,
            proofImage,
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.donateThanks.set(true);
          this.activeTarget.set(null);
          this.donateSubmitting.set(false);
          this.publicApi.loadNeeds(this.courseId).subscribe((rows) => this.needs.set(rows));
          this.refreshDonations();
        },
        error: (err) => {
          this.donateError.set(err?.error?.message ?? 'Could not process your donation right now.');
          this.donateSubmitting.set(false);
        },
      });
  }
}
