import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, throwError } from 'rxjs';
import { ApiEvent, EventApiService } from '../../../core/services/event-api.service';
import { AttendanceApiService, ApiRsvpStatus } from '../../../core/services/attendance-api.service';
import { UserApiService } from '../../../core/services/user-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { ListController } from '../../../core/list-controller';
import { formatDateFull } from '../../../core/date-time.util';
import { TableToolbar } from '../../../shared/table-toolbar/table-toolbar';

interface AttendeeRow {
  userId: string;
  name: string;
  email: string;
  rsvp: ApiRsvpStatus;
  checkedIn: boolean;
}

const RSVP_COLOR: Record<ApiRsvpStatus, string> = {
  confirm: 'var(--w-green)',
  maybe: 'var(--w-gold)',
  cancel: 'var(--w-red)',
};

const RSVP_LABEL: Record<ApiRsvpStatus, string> = {
  confirm: 'Confirmed',
  maybe: 'Maybe',
  cancel: 'Cancelled',
};

@Component({
  selector: 'app-rsvp',
  imports: [TableToolbar],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.scss',
})
export class Rsvp {
  private readonly eventApi = inject(EventApiService);
  private readonly attendanceApi = inject(AttendanceApiService);
  private readonly userApi = inject(UserApiService);
  private readonly modal = inject(CrudModalService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly rsvpColor = RSVP_COLOR;
  readonly rsvpLabel = RSVP_LABEL;
  readonly loading = this.attendanceApi.loading;
  readonly error = this.attendanceApi.error;

  private readonly eventId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: '',
  });

  readonly event = signal<ApiEvent | null>(null);
  readonly dateFull = computed(() => (this.event() ? formatDateFull(new Date(this.event()!.startAt)) : ''));

  private readonly attendeeRows = computed<AttendeeRow[]>(() =>
    this.attendanceApi
      .attendees()
      .map((a) => ({ userId: a.userId, name: a.name, email: a.email, rsvp: a.status, checkedIn: a.checkedIn })),
  );

  readonly ctrl = new ListController<AttendeeRow>(this.attendeeRows);

  readonly waitlistRows = this.attendanceApi.waitlist;

  constructor() {
    this.userApi.load().subscribe();
    this.refresh();
  }

  private refresh(): void {
    const id = this.eventId();
    if (!id) return;
    this.eventApi.getOne(id).subscribe({
      next: (ev) => this.event.set(ev),
      error: (err) => this.showError(err, 'Failed to load event.'),
    });
    this.attendanceApi.load(id).subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goEvents(): void {
    this.router.navigate(['/events']);
  }

  toggleCheckin(row: AttendeeRow): void {
    const id = this.eventId();
    this.attendanceApi.toggleCheckin(id, row.userId).subscribe({
      next: (res) => this.toast.show(`${row.name} ${res.checkedIn ? 'checked in' : 'check-in undone'}.`, 'success'),
      error: (err) => this.showError(err, 'Failed to update check-in.'),
    });
  }

  async removeAttendee(row: AttendeeRow): Promise<void> {
    const confirmed = await this.confirmSvc.ask(`Remove ${row.name} from this event? This cannot be undone.`, {
      title: 'Remove Attendee',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;

    this.attendanceApi.removeAttendee(this.eventId(), row.userId).subscribe({
      next: () => {
        this.toast.show(`${row.name} was removed from this event.`, 'success');
        this.refresh();
      },
      error: (err) => this.showError(err, 'Failed to remove attendee.'),
    });
  }

  promoteFromWaitlist(): void {
    const id = this.eventId();
    this.attendanceApi.promote(id).subscribe({
      next: () => {
        this.toast.show('Next guest promoted from the waitlist to confirmed.', 'success');
        this.refresh();
      },
      error: (err) => this.showError(err, 'Failed to promote from waitlist.'),
    });
  }

  addAttendee(): void {
    const attendingIds = new Set(this.attendeeRows().map((a) => a.userId));
    const candidates = this.userApi
      .users()
      .filter((u) => !attendingIds.has(u.id))
      .map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, id: u.id }));

    if (candidates.length === 0) {
      this.toast.show('No more users available to add — everyone is already RSVP’d.', 'warning');
      return;
    }

    const labelToId = new Map(candidates.map((c) => [c.label, c.id]));

    this.modal.open({
      title: 'Add Attendee',
      fields: [{ key: 'guest', label: 'Guest', type: 'combobox', options: candidates.map((c) => c.label) }],
      isEdit: false,
      values: { guest: '' },
      onSave: (values) => {
        const userId = labelToId.get(String(values['guest'] ?? ''));
        if (!userId) {
          this.toast.show('Please pick a guest from the list.', 'error');
          return throwError(() => new Error('invalid-guest'));
        }
        return this.attendanceApi.addAttendee(this.eventId(), userId).pipe(
          map((res) => {
            this.refresh();
            return {
              ...res,
              toastMessage: res.waitlisted
                ? 'Event is at capacity — guest was added to the waitlist.'
                : 'Guest RSVP confirmed.',
            };
          }),
        );
      },
    });
  }

  // ---- QR check-in ----

  readonly qrOpen = signal(false);
  readonly qrDataUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);
  readonly qrError = signal('');

  openQrDialog(): void {
    this.qrDataUrl.set(null);
    this.qrError.set('');
    this.qrLoading.set(true);
    this.qrOpen.set(true);
    this.attendanceApi.getCheckinQr(this.eventId()).subscribe({
      next: (res) => {
        this.qrDataUrl.set(res.qrDataUrl);
        this.qrLoading.set(false);
      },
      error: (err) => {
        this.qrError.set(err?.error?.message ?? 'Could not load the check-in QR code.');
        this.qrLoading.set(false);
      },
    });
  }

  closeQrDialog(): void {
    this.qrOpen.set(false);
  }
}
