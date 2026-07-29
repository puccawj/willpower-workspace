import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import {
  PublicDonationRow,
  PublicEventApiService,
  PublicEventNeed,
  PublicEventPhoto,
} from '../../../core/services/public-event-api.service';
import { PublicEvent } from '../../../core/models/public-event.models';
import { AuthService } from '../../../core/services/auth.service';
import { ImageViewerService } from '../../../core/services/image-viewer.service';
import { MeApiService, MyRsvpStatus } from '../../../core/services/me-api.service';
import { RatingApiService, RatingSummary } from '../../../core/services/rating-api.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

const GENERAL = 'general';

@Component({
  selector: 'app-event-detail',
  imports: [FormsModule, DatePipe, RouterLink, BackButton],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
})
export class EventDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicApi = inject(PublicEventApiService);
  private readonly meApi = inject(MeApiService);
  private readonly ratingApi = inject(RatingApiService);
  private readonly auth = inject(AuthService);
  private readonly uploads = inject(UploadApiService);
  private readonly imageViewer = inject(ImageViewerService);

  readonly event = signal<PublicEvent | null>(null);
  readonly eventId = this.route.snapshot.paramMap.get('id')!;

  readonly isLoggedIn = this.auth.isLoggedIn;

  private readonly myEvent = computed(() => this.meApi.events().find((e) => e.eventId === this.eventId) ?? null);
  readonly rsvpStatus = computed<MyRsvpStatus | null>(() => this.myEvent()?.rsvpStatus ?? null);
  readonly checkedIn = computed(() => this.myEvent()?.checkedIn ?? false);

  readonly percentFull = computed(() => {
    const ev = this.event();
    if (!ev || !ev.capacity) return 0;
    return Math.min(100, Math.round((ev.going / ev.capacity) * 100));
  });

  readonly rsvpOptions: { key: MyRsvpStatus; label: string }[] = [
    { key: 'confirm', label: 'Yes, I’ll attend' },
    { key: 'maybe', label: 'Maybe' },
    { key: 'cancel', label: 'Can’t make it' },
  ];

  private readonly rsvpMessages: Record<MyRsvpStatus, string> = {
    confirm: 'You’re confirmed — scan the check-in QR code at the door to check yourself in.',
    maybe: 'Marked as maybe. You can confirm any time before the event.',
    cancel: 'You’ve declined this event. You can change your response any time.',
  };

  readonly rsvpMessage = computed(() => {
    const status = this.rsvpStatus();
    return status ? this.rsvpMessages[status] : '';
  });
  readonly rsvpSaving = signal(false);
  readonly rsvpError = signal('');

  readonly eventEnded = computed(() => this.event()?.when === 'past');

  readonly rsvpClosed = computed(() => {
    if (this.eventEnded()) return true;
    const cutoff = this.event()?.rsvpCutoffAt;
    return !!cutoff && new Date() > new Date(cutoff);
  });

  readonly rsvpCutoffLabel = computed(() => {
    const cutoff = this.event()?.rsvpCutoffAt;
    if (!cutoff) return '';
    return new Date(cutoff).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  });

  // ---- Atmosphere photos ----

  readonly photos = signal<PublicEventPhoto[]>([]);

  openPhoto(photo: PublicEventPhoto): void {
    this.imageViewer.open(photo.imageUrl);
  }

  // ---- Star rating ----

  readonly ratingSummary = signal<RatingSummary>({ average: 0, count: 0 });
  readonly myRatingId = signal<string | null>(null);
  readonly myStars = signal(0);
  readonly hoverStars = signal(0);
  readonly myNote = signal('');
  readonly ratingSaving = signal(false);
  readonly ratingSaved = signal(false);

  readonly ratingStars = [1, 2, 3, 4, 5];
  readonly filledStars = computed(() => Math.round(this.ratingSummary().average));

  setHoverStars(n: number): void {
    this.hoverStars.set(n);
  }

  setMyStars(n: number): void {
    this.myStars.set(n);
  }

  submitRating(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/events/${this.eventId}` } });
      return;
    }
    if (!this.myStars()) return;

    this.ratingSaving.set(true);
    this.ratingSaved.set(false);
    this.meApi.rateEvent(this.eventId, this.myStars(), this.myNote().trim() || undefined).subscribe({
      next: (row) => {
        this.myRatingId.set(row.id);
        this.ratingSaving.set(false);
        this.ratingSaved.set(true);
        this.ratingApi.summary('event', this.eventId).subscribe((s) => this.ratingSummary.set(s));
      },
      error: () => {
        this.ratingSaving.set(false);
      },
    });
  }

  // ---- Donation wishlist (needs) + donors ----

  readonly needs = signal<PublicEventNeed[]>([]);
  readonly donations = signal<PublicDonationRow[]>([]);

  readonly needProgress = (need: PublicEventNeed) => {
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

  readonly activeTab = signal<'give' | 'donors'>('give');

  readonly donateOptions: { key: 'money' | 'goods'; label: string }[] = [
    { key: 'money', label: 'Funds' },
    { key: 'goods', label: 'Goods' },
  ];

  readonly donateType = signal<'money' | 'goods'>('money');

  /** null = no donate form open; 'general' = untargeted donation; otherwise an EventNeed id. */
  readonly activeTarget = signal<string | null>(null);
  readonly activeNeed = computed(() => {
    const t = this.activeTarget();
    return t && t !== GENERAL ? this.needs().find((n) => n.id === t) ?? null : null;
  });

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
    this.publicApi.loadOne(this.eventId).subscribe((e) => this.event.set(e));
    this.meApi.loadEvents().subscribe();
    this.publicApi.loadNeeds(this.eventId).subscribe((rows) => this.needs.set(rows));
    this.publicApi.loadPhotos(this.eventId).subscribe((rows) => this.photos.set(rows));
    this.ratingApi.summary('event', this.eventId).subscribe((s) => this.ratingSummary.set(s));
    if (this.auth.isLoggedIn()) {
      this.refreshDonations();
      this.meApi.myEventRating(this.eventId).subscribe((r) => {
        if (r) {
          this.myRatingId.set(r.id);
          this.myStars.set(r.stars);
          this.myNote.set(r.note ?? '');
        }
      });
    }
  }

  private refreshDonations(): void {
    this.publicApi.loadDonations(this.eventId).subscribe((rows) => {
      this.donations.set([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  }

  setRsvp(choice: MyRsvpStatus): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/events/${this.eventId}` } });
      return;
    }
    if (this.rsvpClosed()) return;

    this.rsvpSaving.set(true);
    this.rsvpError.set('');
    this.meApi.setRsvp(this.eventId, choice).subscribe({
      next: () => this.rsvpSaving.set(false),
      error: (err) => {
        this.rsvpError.set(err?.error?.message ?? 'Could not update your RSVP right now.');
        this.rsvpSaving.set(false);
      },
    });
  }

  setActiveTab(tab: 'give' | 'donors'): void {
    this.activeTab.set(tab);
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
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/events/${this.eventId}` } });
      return;
    }

    const ev = this.event();
    const user = this.auth.currentUser();
    if (!ev || !user) return;
    if (this.eventEnded()) return;

    this.donateError.set('');

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
            branchId: ev.branchId,
            eventId: ev.id,
            needId: need?.id,
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
          this.publicApi.loadNeeds(this.eventId).subscribe((rows) => this.needs.set(rows));
          this.refreshDonations();
        },
        error: (err) => {
          this.donateError.set(err?.error?.message ?? 'Could not process your donation right now.');
          this.donateSubmitting.set(false);
        },
      });
  }
}
