import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, throwError } from 'rxjs';
import { avatarColorFor, initialsOf } from '../../core/services/admin-data.service';
import { ApiCourseSession, OfferingApiService } from '../../core/services/offering-api.service';
import { ApiEnrollmentRow, EnrollmentApiService } from '../../core/services/enrollment-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';

interface EnrollmentRow {
  userId: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  enrolledLabel: string;
  pctLabel: string;
  pctValue: number;
  pctColor: string;
  present: boolean;
  presentLabel: string;
  presentColor: string;
}

function toRow(e: ApiEnrollmentRow): EnrollmentRow {
  return {
    userId: e.userId,
    name: e.name,
    email: e.email,
    initials: initialsOf(e.name),
    avatarColor: avatarColorFor(e.name),
    enrolledLabel: new Date(e.enrolledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    pctLabel: `${e.attendancePercent}%`,
    pctValue: e.attendancePercent,
    pctColor: e.attendancePercent >= 80 ? 'var(--w-green)' : e.attendancePercent >= 60 ? 'var(--w-gold)' : 'var(--w-red)',
    present: e.presentThisSession,
    presentLabel: e.presentThisSession ? 'Present' : 'Absent',
    presentColor: e.presentThisSession ? 'var(--w-green)' : 'var(--w-red)',
  };
}

@Component({
  selector: 'app-enrollment',
  imports: [TableToolbar, FormsModule],
  templateUrl: './enrollment.html',
  styleUrl: './enrollment.scss',
})
export class Enrollment {
  private readonly offeringApi = inject(OfferingApiService);
  private readonly enrollmentApi = inject(EnrollmentApiService);
  private readonly userApi = inject(UserApiService);
  private readonly modal = inject(CrudModalService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = this.enrollmentApi.loading;
  readonly error = this.enrollmentApi.error;

  private readonly queryOfferingId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('offeringId') ?? '')),
    { initialValue: '' },
  );

  readonly offerings = this.offeringApi.offerings;
  readonly selectedOfferingId = signal('');
  readonly sessions = signal<ApiCourseSession[]>([]);
  readonly selectedSessionId = signal('');

  readonly selectedOffering = computed(() => this.offerings().find((o) => o.id === this.selectedOfferingId()) ?? null);
  readonly selectedSession = computed(() => this.sessions().find((s) => s.id === this.selectedSessionId()) ?? null);

  private readonly rows = computed<EnrollmentRow[]>(() => this.enrollmentApi.enrollments().map(toRow));

  readonly ctrl = new ListController<EnrollmentRow>(this.rows);

  constructor() {
    this.offeringApi.load().subscribe(() => {
      const initial = this.queryOfferingId() || this.offerings()[0]?.id || '';
      if (initial) this.selectOffering(initial);
    });
    this.userApi.load().subscribe();
  }

  selectOffering(offeringId: string): void {
    this.selectedOfferingId.set(offeringId);
    this.selectedSessionId.set('');
    this.sessions.set([]);
    if (!offeringId) return;

    this.offeringApi.listSessions(offeringId).subscribe({
      next: (rows) => {
        this.sessions.set(rows);
        const today = new Date().toISOString().slice(0, 10);
        const defaultSession = rows.find((s) => s.sessionDate >= today) ?? rows[rows.length - 1] ?? rows[0];
        if (defaultSession) this.selectSession(defaultSession.id);
      },
      error: (err) => this.showError(err, 'Failed to load sessions.'),
    });
  }

  selectSession(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
    this.enrollmentApi.load(this.selectedOfferingId(), sessionId).subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  toggleAttendance(row: EnrollmentRow): void {
    const offeringId = this.selectedOfferingId();
    const sessionId = this.selectedSessionId();
    if (!sessionId) return;

    this.enrollmentApi.toggleAttendance(offeringId, sessionId, row.userId).subscribe({
      next: (res) => this.toast.show(`${row.name} marked ${res.checkedIn ? 'present' : 'absent'}.`, 'success'),
      error: (err) => this.showError(err, 'Failed to update attendance.'),
    });
  }

  async removeEnrollment(row: EnrollmentRow): Promise<void> {
    const confirmed = await this.confirmSvc.ask(`Remove ${row.name} from this offering? This cannot be undone.`, {
      title: 'Remove Enrollment',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;

    this.enrollmentApi.removeEnrollment(this.selectedOfferingId(), row.userId, this.selectedSessionId()).subscribe({
      next: () => this.toast.show(`${row.name} was removed from this offering.`, 'success'),
      error: (err) => this.showError(err, 'Failed to remove enrollment.'),
    });
  }

  addStudent(): void {
    const enrolledIds = new Set(this.rows().map((r) => r.userId));
    const candidates = this.userApi
      .users()
      .filter((u) => !enrolledIds.has(u.id))
      .map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, id: u.id }));

    if (candidates.length === 0) {
      this.toast.show('No more users available to enroll.', 'warning');
      return;
    }

    const labelToId = new Map(candidates.map((c) => [c.label, c.id]));

    this.modal.open({
      title: 'Add Student',
      fields: [{ key: 'student', label: 'Student', type: 'combobox', options: candidates.map((c) => c.label) }],
      isEdit: false,
      values: { student: '' },
      onSave: (values) => {
        const userId = labelToId.get(String(values['student'] ?? ''));
        if (!userId) {
          this.toast.show('Please pick a student from the list.', 'error');
          return throwError(() => new Error('invalid-student'));
        }
        return this.enrollmentApi.enroll(this.selectedOfferingId(), userId, this.selectedSessionId());
      },
    });
  }

  // ---- QR check-in ----

  readonly qrOpen = signal(false);
  readonly qrDataUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);
  readonly qrError = signal('');

  openQrDialog(): void {
    const offeringId = this.selectedOfferingId();
    const sessionId = this.selectedSessionId();
    if (!sessionId) return;

    this.qrDataUrl.set(null);
    this.qrError.set('');
    this.qrLoading.set(true);
    this.qrOpen.set(true);
    this.enrollmentApi.getSessionCheckinQr(offeringId, sessionId).subscribe({
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
