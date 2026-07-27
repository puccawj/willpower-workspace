import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, map, of, switchMap } from 'rxjs';
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
import { DonateType } from '../../../core/models/willpower.models';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ImageViewerService } from '../../../core/services/image-viewer.service';
import { MeApiService } from '../../../core/services/me-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { UploadApiService } from '../../../core/services/upload-api.service';

@Component({
  selector: 'app-course-detail',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail {
  private readonly api = inject(PublicCourseApiService);
  private readonly meApi = inject(MeApiService);
  private readonly auth = inject(AuthService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly imageViewer = inject(ImageViewerService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly isStudent = computed(() => this.auth.currentUser()?.role === 'student');

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: '',
  });

  /** Which offering the visitor arrived to view (via Home/Courses list) — null shows every offering. */
  private readonly offeringIdParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('offering'))),
    { initialValue: null as string | null },
  );

  readonly course = signal<PublicCourseDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  // ---- Offerings / enroll ----

  readonly offerings = signal<PublicOffering[]>([]);
  readonly offeringsLoading = signal(false);
  readonly offeringsError = signal('');
  readonly enrollingOfferingId = signal<string | null>(null);
  readonly enrolledOfferingIds = signal<Set<string>>(new Set());
  readonly enrollError = signal('');
  readonly expandedOfferingId = signal<string | null>(null);

  readonly formatSchedule = formatSchedule;
  readonly shortDate = shortDate;

  /** Only the offering the visitor arrived to view, if any — otherwise every open offering. */
  readonly visibleOfferings = computed(() => {
    const target = this.offeringIdParam();
    if (!target) return this.offerings();
    const match = this.offerings().filter((o) => o.id === target);
    return match.length ? match : this.offerings();
  });

  /** Fallback branch for whole-course (no specific offering) needs/general donations. */
  private readonly donationBranchId = computed(() => this.offerings()[0]?.branchId ?? null);

  toggleOfferingDetails(offeringId: string): void {
    this.expandedOfferingId.set(this.expandedOfferingId() === offeringId ? null : offeringId);
  }

  enrollIn(offeringId: string): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/courses/${this.id()}` } });
      return;
    }
    this.enrollingOfferingId.set(offeringId);
    this.enrollError.set('');
    this.meApi.enrollSelf(offeringId).subscribe({
      next: () => {
        this.enrollingOfferingId.set(null);
        this.enrolledOfferingIds.update((set) => new Set(set).add(offeringId));
      },
      error: (err) => {
        this.enrollingOfferingId.set(null);
        this.enrollError.set(err?.error?.message ?? 'Could not enroll you right now.');
      },
    });
  }

  // ---- Donation wishlist (needs), scoped per offering + whole course ----

  readonly needs = signal<PublicCourseNeed[]>([]);
  readonly needsLoading = signal(false);

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

  readonly donations = signal<PublicDonationRow[]>([]);
  readonly donationsLoading = signal(false);

  donationsForOffering(offeringId: string): PublicDonationRow[] {
    return this.donations().filter((d) => d.offeringId === offeringId);
  }

  // ---- Atmosphere photos ----

  readonly photos = signal<PublicCoursePhoto[]>([]);
  readonly photosLoading = signal(false);

  openPhoto(photo: PublicCoursePhoto): void {
    this.imageViewer.open(photo.imageUrl);
  }

  readonly formatMoney = (value: string | null): string => {
    const n = Number(value ?? 0);
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  readonly donateOptions: { key: DonateType; label: string }[] = [
    { key: 'money', label: 'Funds' },
    { key: 'goods', label: 'Goods' },
  ];

  readonly donateType = signal<DonateType>('money');

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

  /** True for a general (non-need-targeted) goods donation — the only case that needs its own item name/unit fields. */
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

  /**
   * Sanitizes and force-resets the native input's DOM value on every keystroke.
   * A plain [ngModel]/(ngModelChange) split binding only rewrites the DOM when the bound
   * signal actually changes — if a typed letter gets stripped back to the same number as
   * before, Angular skips the DOM update and the letter stays visible in the box. Reading
   * from and writing back to `input.value` directly avoids that.
   */
  onDonateAmountInput(input: HTMLInputElement): void {
    const cleaned = input.value.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    const sanitized = rest.length ? `${whole}.${rest.join('')}` : whole;
    if (input.value !== sanitized) input.value = sanitized;
    this.donateAmount.set(sanitized);
  }

  constructor() {
    effect(() => {
      const id = this.id();
      this.offerings.set([]);
      this.enrolledOfferingIds.set(new Set());
      this.enrollError.set('');
      this.expandedOfferingId.set(null);
      this.needs.set([]);
      this.donations.set([]);
      this.photos.set([]);
      this.activeTarget.set(null);
      this.donateThanks.set(false);
      this.donateAmount.set('');
      this.donatePhone.set('');
      this.donateItemName.set('');
      this.donateUnit.set(this.donateUnitOptions[0]);
      this.proofFile.set(null);
      this.donateError.set('');
      if (!id) return;

      this.loading.set(true);
      this.error.set('');
      this.api.loadOne(id).subscribe({
        next: (course) => {
          this.course.set(course);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('This course could not be found.');
          this.loading.set(false);
        },
      });

      const targetOfferingId = this.route.snapshot.queryParamMap.get('offering');
      if (targetOfferingId) this.expandedOfferingId.set(targetOfferingId);

      this.offeringsLoading.set(true);
      this.api.loadOfferings(id).subscribe({
        next: (rows) => {
          this.offerings.set(rows);
          this.offeringsLoading.set(false);
          if (targetOfferingId) {
            setTimeout(() => {
              document.getElementById('offering-' + targetOfferingId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
        },
        error: () => {
          this.offeringsError.set('Could not load available class times.');
          this.offeringsLoading.set(false);
        },
      });

      this.needsLoading.set(true);
      this.api.loadNeeds(id).subscribe({
        next: (rows) => {
          this.needs.set(rows);
          this.needsLoading.set(false);
        },
        error: () => this.needsLoading.set(false),
      });

      this.photosLoading.set(true);
      this.api.loadPhotos(id).subscribe({
        next: (rows) => {
          this.photos.set(rows);
          this.photosLoading.set(false);
        },
        error: () => this.photosLoading.set(false),
      });

      if (this.auth.isLoggedIn()) {
        this.refreshDonations(id);
      }
    });
  }

  private refreshDonations(courseId: string): void {
    this.donationsLoading.set(true);
    this.api.loadDonations(courseId).subscribe({
      next: (rows) => {
        this.donations.set([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.donationsLoading.set(false);
      },
      error: () => this.donationsLoading.set(false),
    });
  }

  setDonateType(type: DonateType): void {
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

  async submitDonate(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/courses/${this.id()}` } });
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
    const target = need ? need.title : isGeneralGoods ? itemName : offering ? `this course (${offering.branchName})` : 'this course';
    const unit = need?.unit ?? (isGeneralGoods ? this.donateUnit() : '');
    const amountLabel = type === 'money' ? this.formatMoney(amountText) : `${amountText}${unit ? ' ' + unit : ''}`;

    const confirmed = await this.confirmService.ask(`Donate ${amountLabel} to ${target}?`, {
      title: 'Confirm your donation',
      confirmLabel: 'Donate',
    });
    if (!confirmed) return;

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
          this.toast.show('Thank you! Your donation has been submitted for approval.', 'success');
          this.api.loadNeeds(course.id).subscribe((rows) => this.needs.set(rows));
          if (this.auth.isLoggedIn()) this.refreshDonations(course.id);
        },
        error: (err) => {
          const message = err?.error?.message ?? 'Could not process your donation right now.';
          this.donateError.set(message);
          this.donateSubmitting.set(false);
          this.toast.show(message, 'error');
        },
      });
  }
}
