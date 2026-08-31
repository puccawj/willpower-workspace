import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { avatarColorFor, initialsOf } from '../../core/services/admin-data.service';
import { ApiCourseSession, OfferingApiService } from '../../core/services/offering-api.service';
import { ApiEnrollmentRow, EnrollmentApiService } from '../../core/services/enrollment-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { Typeahead, TypeaheadOption } from '../../shared/typeahead/typeahead';
import { StatCardData, StatCards } from '../../shared/stat-cards/stat-cards';

function formatSessionDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
  /** sessionId -> present, for O(1) cell lookup while rendering the attendance grid. */
  attendanceMap: Map<string, boolean>;
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
    pctColor: e.isPassing ? 'var(--w-green)' : e.attendancePercent >= e.passingPercent * 0.75 ? 'var(--w-gold)' : 'var(--w-red)',
    attendanceMap: new Map(e.sessionAttendance.map((c) => [c.sessionId, c.present])),
  };
}

@Component({
  selector: 'app-enrollment',
  imports: [TableToolbar, FormsModule, Typeahead, StatCards],
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
  /** Which session's QR code to show — the roster grid itself always shows every session as a
   * column, this only picks the QR dialog's target session. Defaults to the next upcoming one. */
  readonly qrSessionId = signal('');

  readonly selectedOffering = computed(() => this.offerings().find((o) => o.id === this.selectedOfferingId()) ?? null);
  readonly qrSession = computed(() => this.sessions().find((s) => s.id === this.qrSessionId()) ?? null);

  /** Searchable instead of a flat <select> with every offering in the institute in one unscannable
   * list — the whole point of this redesign. Code/nickname included so offerings of the same
   * course (e.g. two "Contemplative Study Circle" runs) are distinguishable in the dropdown. */
  readonly offeringOptions = computed<TypeaheadOption[]>(() =>
    this.offerings().map((o) => ({
      id: o.id,
      label: `${o.courseTitle}${o.code ? ' — ' + o.code : ''} — ${o.branchName} (${o.instructorName ?? 'Unassigned'})`,
    })),
  );
  formatSessionColumn(s: ApiCourseSession): string {
    return `${s.sessionNo} · ${formatSessionDate(s.sessionDate)}`;
  }

  readonly offeringMetaLabel = computed(() => {
    const o = this.selectedOffering();
    if (!o) return '';
    const mode = o.mode === 'onsite' ? 'Onsite' : 'Online';
    return `${o.branchName} · ${o.instructorName ?? 'Unassigned'} · ${mode} · ${formatDate(o.startDate)} – ${formatDate(o.endDate)}`;
  });

  private readonly rows = computed<EnrollmentRow[]>(() => this.enrollmentApi.enrollments().map(toRow));

  readonly ctrl = new ListController<EnrollmentRow>(this.rows);

  attendanceFor(row: EnrollmentRow, sessionId: string): boolean {
    return row.attendanceMap.get(sessionId) ?? false;
  }

  /** Quick-glance roster stats above the grid — enrolled headcount, how many checked in for the
   * current (next-upcoming or most-recent) session, and the offering's average cumulative attendance. */
  readonly statCards = computed<StatCardData[]>(() => {
    const rows = this.rows();
    const enrolled = rows.length;
    const currentSessionId = this.qrSessionId();
    const present = currentSessionId ? rows.filter((r) => r.attendanceMap.get(currentSessionId)).length : 0;
    const avgAttendance = enrolled ? Math.round(rows.reduce((sum, r) => sum + r.pctValue, 0) / enrolled) : 0;
    const off = this.selectedOffering();
    return [
      { label: 'Enrolled', value: enrolled, sub: off?.capacity ? `of ${off.capacity} capacity` : undefined },
      { label: 'Present this session', value: `${present}/${enrolled}` },
      { label: 'Avg. cumulative attendance', value: `${avgAttendance}%` },
    ];
  });

  constructor() {
    this.offeringApi.load().subscribe(() => {
      const initial = this.queryOfferingId() || this.offerings()[0]?.id || '';
      if (initial) this.selectOffering(initial);
    });
    this.userApi.load().subscribe();
  }

  selectOffering(offeringId: string): void {
    this.selectedOfferingId.set(offeringId);
    this.qrSessionId.set('');
    this.sessions.set([]);
    if (!offeringId) return;

    this.enrollmentApi.load(offeringId).subscribe();
    this.offeringApi.listSessions(offeringId).subscribe({
      next: (rows) => {
        this.sessions.set(rows);
        const today = new Date().toISOString().slice(0, 10);
        const defaultSession = rows.find((s) => s.sessionDate >= today) ?? rows[rows.length - 1] ?? rows[0];
        if (defaultSession) this.qrSessionId.set(defaultSession.id);
      },
      error: (err) => this.showError(err, 'Failed to load sessions.'),
    });
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  toggleAttendance(row: EnrollmentRow, sessionId: string): void {
    const offeringId = this.selectedOfferingId();
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

    this.enrollmentApi.removeEnrollment(this.selectedOfferingId(), row.userId).subscribe({
      next: () => this.toast.show(`${row.name} was removed from this offering.`, 'success'),
      error: (err) => this.showError(err, 'Failed to remove enrollment.'),
    });
  }

  addStudent(): void {
    const enrolledIds = new Set(this.rows().map((r) => r.userId));
    const candidates = this.userApi
      .users()
      .filter((u) => u.role === 'student' && !enrolledIds.has(u.id))
      .map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName} (${u.email})` }));

    if (candidates.length === 0) {
      this.toast.show('No more users available to enroll.', 'warning');
      return;
    }

    this.modal.open({
      title: 'Add Student',
      fields: [{ key: 'student', label: 'Student', type: 'typeahead', relOptions: candidates }],
      isEdit: false,
      values: { student: '' },
      onSave: (values) => {
        const userId = String(values['student'] ?? '');
        if (!userId) {
          this.toast.show('Please pick a student from the list.', 'error');
          return throwError(() => new Error('invalid-student'));
        }
        return this.enrollWithPrerequisiteOverride(userId);
      },
    });
  }

  /** Attempts a normal enroll; if it fails on the missing-prerequisite check, offers an explicit
   * admin override ("enroll anyway") and retries with `force: true` if confirmed. */
  private enrollWithPrerequisiteOverride(userId: string): Observable<unknown> {
    const offeringId = this.selectedOfferingId();
    return this.enrollmentApi.enroll(offeringId, userId).pipe(
      catchError((err) => {
        const message = (err as { error?: { message?: string } })?.error?.message ?? '';
        if (!/not completed/i.test(message)) return throwError(() => err);

        return from(
          this.confirmSvc.ask("This student hasn't completed the prerequisite — enroll anyway?", {
            title: 'Missing Prerequisite',
            confirmLabel: 'Enroll Anyway',
            danger: false,
          }),
        ).pipe(
          switchMap((confirmed) => {
            if (!confirmed) return throwError(() => err);
            return this.enrollmentApi.enroll(offeringId, userId, undefined, true);
          }),
        );
      }),
    );
  }

  // ---- QR check-in ----

  readonly qrOpen = signal(false);
  readonly qrDataUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);
  readonly qrError = signal('');

  openQrDialog(): void {
    const offeringId = this.selectedOfferingId();
    const sessionId = this.qrSessionId();
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

  printQr(): void {
    window.print();
  }
}
