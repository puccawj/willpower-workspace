import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import {
  PublicDonationRow,
  PublicEventApiService,
  PublicEventNeed,
} from '../../../core/services/public-event-api.service';
import { PublicEvent } from '../../../core/models/public-event.models';
import { DonateType, RsvpChoice } from '../../../core/models/willpower.models';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { MeApiService } from '../../../core/services/me-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { QrCamera } from '../../../shared/qr-camera/qr-camera';

const GENERAL = 'general';

@Component({
  selector: 'app-event-detail',
  imports: [RouterLink, FormsModule, QrCamera, DatePipe],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
})
export class EventDetail {
  private readonly api = inject(PublicEventApiService);
  private readonly meApi = inject(MeApiService);
  private readonly auth = inject(AuthService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoggedIn = this.auth.isLoggedIn;

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: '',
  });

  readonly event = signal<PublicEvent | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly percentFull = computed(() => {
    const ev = this.event();
    if (!ev || !ev.capacity) return 0;
    return Math.min(100, Math.round((ev.going / ev.capacity) * 100));
  });

  readonly rsvpOptions: { key: RsvpChoice; label: string }[] = [
    { key: 'confirm', label: 'Yes, I’ll attend' },
    { key: 'maybe', label: 'Maybe' },
    { key: 'cancel', label: 'Can’t make it' },
  ];

  private readonly rsvpMessages: Record<RsvpChoice, string> = {
    confirm: 'You’re confirmed — scan the check-in QR code at the door to check yourself in.',
    maybe: 'Marked as maybe. You can confirm any time before the event.',
    cancel: 'You’ve declined this event. You can change your response any time.',
  };

  readonly rsvp = signal<RsvpChoice | null>(null);
  readonly rsvpMessage = computed(() => (this.rsvp() ? this.rsvpMessages[this.rsvp()!] : ''));
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

  readonly scanOpen = signal(false);
  readonly scanSubmitting = signal(false);
  readonly scanError = signal('');
  readonly checkedIn = signal(false);

  // ---- Donation wishlist (needs) ----

  readonly needs = signal<PublicEventNeed[]>([]);
  readonly needsLoading = signal(false);

  readonly needProgress = (need: PublicEventNeed) => {
    const target = Number(need.targetQuantity);
    const received = Number(need.receivedQuantity);
    const pct = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : 0;
    const unitLabel = need.type === 'money' ? 'USD' : (need.unit ?? '');
    return { pct, label: `${received.toLocaleString()} / ${target.toLocaleString()} ${unitLabel}`.trim() };
  };

  readonly donations = signal<PublicDonationRow[]>([]);
  readonly donationsLoading = signal(false);

  readonly formatMoney = (value: string | null): string => {
    const n = Number(value ?? 0);
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  readonly activeTab = signal<'give' | 'donors'>('give');

  readonly donateOptions: { key: DonateType; label: string }[] = [
    { key: 'money', label: 'Funds' },
    { key: 'goods', label: 'Goods' },
  ];

  readonly donateType = signal<DonateType>('money');

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
      this.rsvp.set(null);
      this.rsvpError.set('');
      this.scanOpen.set(false);
      this.scanError.set('');
      this.checkedIn.set(false);
      this.needs.set([]);
      this.donations.set([]);
      this.activeTab.set('give');
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
        next: (ev) => {
          this.event.set(ev);
          this.loading.set(false);
          if (this.auth.isLoggedIn()) {
            this.meApi.loadEvents().subscribe((rows) => {
              const mine = rows.find((r) => r.eventId === id);
              if (mine) {
                this.rsvp.set(mine.rsvpStatus);
                this.checkedIn.set(mine.checkedIn);
              }
            });
          }
        },
        error: () => {
          this.error.set('This event could not be found.');
          this.loading.set(false);
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

      if (this.auth.isLoggedIn()) {
        this.refreshDonations(id);
      }
    });
  }

  private refreshDonations(eventId: string): void {
    this.donationsLoading.set(true);
    this.api.loadDonations(eventId).subscribe({
      next: (rows) => {
        this.donations.set([...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        this.donationsLoading.set(false);
      },
      error: () => this.donationsLoading.set(false),
    });
  }

  setRsvp(choice: RsvpChoice): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/events/${this.id()}` } });
      return;
    }
    if (this.rsvpClosed()) return;

    this.rsvpSaving.set(true);
    this.rsvpError.set('');
    this.meApi.setRsvp(this.id(), choice).subscribe({
      next: () => {
        this.rsvp.set(choice);
        this.rsvpSaving.set(false);
      },
      error: (err) => {
        this.rsvpError.set(err?.error?.message ?? 'Could not update your RSVP right now.');
        this.rsvpSaving.set(false);
      },
    });
  }

  openScan(): void {
    this.scanError.set('');
    this.scanOpen.set(true);
  }

  closeScan(): void {
    this.scanOpen.set(false);
  }

  onCodeDetected(code: string): void {
    if (code !== this.id()) {
      this.scanError.set('This QR code is for a different event.');
      return;
    }

    this.scanSubmitting.set(true);
    this.scanError.set('');
    this.meApi.checkinEvent(this.id()).subscribe({
      next: () => {
        this.checkedIn.set(true);
        this.scanOpen.set(false);
        this.scanSubmitting.set(false);
      },
      error: (err) => {
        this.scanError.set(err?.error?.message ?? 'Could not check you in right now.');
        this.scanSubmitting.set(false);
      },
    });
  }

  setActiveTab(tab: 'give' | 'donors'): void {
    this.activeTab.set(tab);
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
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/events/${this.id()}` } });
      return;
    }

    const ev = this.event();
    const user = this.auth.currentUser();
    if (!ev || !user) return;

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
    const target = need ? need.title : isGeneralGoods ? itemName : 'this event';
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
          this.toast.show('Thank you! Your donation has been submitted for approval.', 'success');
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
