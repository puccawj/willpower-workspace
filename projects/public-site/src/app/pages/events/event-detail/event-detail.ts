import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PublicEventApiService } from '../../../core/services/public-event-api.service';
import { PublicEvent } from '../../../core/models/public-event.models';
import { DonateType, RsvpChoice } from '../../../core/models/willpower.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeApiService } from '../../../core/services/me-api.service';
import { QrCamera } from '../../../shared/qr-camera/qr-camera';

@Component({
  selector: 'app-event-detail',
  imports: [RouterLink, FormsModule, QrCamera],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
})
export class EventDetail {
  private readonly api = inject(PublicEventApiService);
  private readonly meApi = inject(MeApiService);
  private readonly auth = inject(AuthService);
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

  readonly rsvpClosed = computed(() => {
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

  readonly donateOptions: { key: DonateType; label: string }[] = [
    { key: 'money', label: 'Funds' },
    { key: 'goods', label: 'Goods' },
  ];

  readonly donateType = signal<DonateType>('money');
  readonly donateAmount = signal('');
  readonly donatePhone = signal('');
  readonly donated = signal(false);
  readonly donateSubmitting = signal(false);
  readonly donateError = signal('');

  readonly donatePlaceholder = computed(() =>
    this.donateType() === 'money' ? 'Amount (USD)' : 'Describe the goods (e.g. 10 kg rice)',
  );

  constructor() {
    effect(() => {
      const id = this.id();
      this.rsvp.set(null);
      this.rsvpError.set('');
      this.scanOpen.set(false);
      this.scanError.set('');
      this.checkedIn.set(false);
      this.donated.set(false);
      this.donateAmount.set('');
      this.donatePhone.set('');
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

  setDonateType(type: DonateType): void {
    this.donateType.set(type);
  }

  submitDonate(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/events/${this.id()}` } });
      return;
    }

    const ev = this.event();
    const user = this.auth.currentUser();
    if (!ev || !user) return;

    this.donateError.set('');

    if (!this.donateAmount().trim()) {
      this.donateError.set(this.donateType() === 'money' ? 'Please enter a donation amount.' : 'Please describe the goods you are donating.');
      return;
    }
    if (!this.donatePhone().trim()) {
      this.donateError.set('Please enter a phone number.');
      return;
    }

    this.donateSubmitting.set(true);
    this.meApi
      .donate({
        donorName: user.name,
        donorEmail: user.email,
        donorPhoneNumber: this.donatePhone().trim(),
        type: this.donateType(),
        amountOrItem: this.donateAmount().trim(),
        branchId: ev.branchId,
        eventId: ev.id,
      })
      .subscribe({
        next: () => {
          this.donated.set(true);
          this.donateSubmitting.set(false);
        },
        error: (err) => {
          this.donateError.set(err?.error?.message ?? 'Could not process your donation right now.');
          this.donateSubmitting.set(false);
        },
      });
  }
}
