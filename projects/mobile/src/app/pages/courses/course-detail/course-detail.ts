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
import { AuthService } from '../../../core/services/auth.service';
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
  private readonly auth = inject(AuthService);
  private readonly uploads = inject(UploadApiService);
  private readonly imageViewer = inject(ImageViewerService);

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

  toggleOfferingDetails(offeringId: string): void {
    this.expandedOfferingId.set(this.expandedOfferingId() === offeringId ? null : offeringId);
  }

  // ---- Atmosphere photos ----

  readonly photos = signal<PublicCoursePhoto[]>([]);

  openPhoto(photo: PublicCoursePhoto): void {
    this.imageViewer.open(photo.imageUrl);
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

  enrollIn(offeringId: string): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/courses/${this.courseId}` } });
      return;
    }
    this.enrollingOfferingId.set(offeringId);
    this.enrollError.set('');
    this.meApi.enrollSelf(offeringId).subscribe({
      next: () => this.enrollingOfferingId.set(null),
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
    const offering = this.activeOffering();

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
