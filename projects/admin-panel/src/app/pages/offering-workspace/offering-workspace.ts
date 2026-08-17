import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  concatMap,
  from,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { avatarColorFor, initialsOf } from '../../core/services/admin-data.service';
import { ApiCourse, CourseApiService } from '../../core/services/course-api.service';
import {
  ApiCourseSession,
  ApiOffering,
  ApiOfferingStatus,
  OfferingApiService,
  OfferingPayload,
  SessionPayload,
} from '../../core/services/offering-api.service';
import { ApiEnrollmentRow, EnrollmentApiService } from '../../core/services/enrollment-api.service';
import { ApiCourseNeed, ApiCourseNeedType, CourseNeedApiService } from '../../core/services/course-need-api.service';
import { CertificateApiService } from '../../core/services/certificate-api.service';
import { ApiCertificateTemplate, CertificateTemplateApiService } from '../../core/services/certificate-template-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { PdfService } from '../../core/services/pdf.service';
import { CertificatePreviewService } from '../../core/services/certificate-preview.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';
import { FilterTabs } from '../../shared/filter-tabs/filter-tabs';
import { FieldDef } from '../../core/models/admin.models';

type Tab = 'overview' | 'sessions' | 'roster' | 'needs' | 'certificates';

const WHOLE_COURSE = 'Not session-specific';

function sessionFields(): FieldDef[] {
  return [
    { key: 'sessionDate', label: 'Session date', type: 'date' },
    { key: 'startTime', label: 'Start time', type: 'text', hint: '24-hour HH:mm, e.g. 18:00' },
    { key: 'endTime', label: 'End time', type: 'text', hint: '24-hour HH:mm, e.g. 20:00' },
    { key: 'topic', label: 'Topic', type: 'text', hint: 'Optional' },
    { key: 'location', label: 'Location', type: 'text', hint: 'Optional — defaults to the offering location' },
  ];
}

const STATUS_COLOR: Record<ApiOfferingStatus, string> = {
  draft: 'var(--w-muted)',
  published: 'var(--w-green)',
  completed: 'var(--w-ink-soft)',
  cancelled: 'var(--w-red)',
};
const STATUS_OPTIONS = ['Draft', 'Publish', 'Completed', 'Cancelled'];
const STATUS_TO_API: Record<string, ApiOfferingStatus> = {
  Draft: 'draft',
  Publish: 'published',
  Completed: 'completed',
  Cancelled: 'cancelled',
};
const STATUS_LABEL: Record<ApiOfferingStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
/** Maps an offering's status to the exact option string in STATUS_OPTIONS — distinct from
 * STATUS_LABEL (which reads naturally as a badge, e.g. "Published") because the <select>'s
 * bound value must exactly match one of its own <option> values or the browser shows it blank. */
const STATUS_TO_OPTION: Record<ApiOfferingStatus, string> = {
  draft: 'Draft',
  published: 'Publish',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Client-side "effective" status badge — computed from dates, never written back to the DB.
 * A cancelled offering always stays cancelled; otherwise the end date decides published/completed. */
function effectiveStatus(o: ApiOffering): ApiOfferingStatus {
  if (o.status === 'cancelled' || o.status === 'draft') return o.status;
  const today = new Date().toISOString().slice(0, 10);
  if (today > o.endDate) return 'completed';
  return 'published';
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
  present: boolean;
  presentLabel: string;
  presentColor: string;
}

function toEnrollmentRow(e: ApiEnrollmentRow): EnrollmentRow {
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
    present: e.presentThisSession,
    presentLabel: e.presentThisSession ? 'Present' : 'Absent',
    presentColor: e.presentThisSession ? 'var(--w-green)' : 'var(--w-red)',
  };
}

interface NeedRow {
  id: string;
  title: string;
  sessionLabel: string;
  type: ApiCourseNeedType;
  unit: string | null;
  target: number;
  received: number;
  pct: number;
  progressLabel: string;
}

function toNeedRow(n: ApiCourseNeed): NeedRow {
  const target = Number(n.targetQuantity);
  const received = Number(n.receivedQuantity);
  const pct = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : 0;
  const unitLabel = n.type === 'money' ? 'USD' : (n.unit ?? '');
  return {
    id: n.id,
    title: n.title,
    sessionLabel: n.sessionNumber ? `Session ${n.sessionNumber}` : WHOLE_COURSE,
    type: n.type,
    unit: n.unit,
    target,
    received,
    pct,
    progressLabel: `${received.toLocaleString()} / ${target.toLocaleString()} ${unitLabel}`.trim(),
  };
}

interface CertRow {
  userId: string;
  name: string;
  email: string;
  pctLabel: string;
  pctValue: number;
  eligible: boolean;
  eligibleLabel: string;
  eligibleColor: string;
  issued: boolean;
  certId: string;
  certNo: string;
  templateId: string;
  issuedAt: string;
  fileUrl: string;
  issueLabel: string;
  actionIcon: string;
  actionColor: string;
}

@Component({
  selector: 'app-offering-workspace',
  imports: [FormsModule, FilterTabs],
  templateUrl: './offering-workspace.html',
  styleUrl: './offering-workspace.scss',
})
export class OfferingWorkspace {
  private readonly courseApi = inject(CourseApiService);
  private readonly offeringApi = inject(OfferingApiService);
  private readonly enrollmentApi = inject(EnrollmentApiService);
  private readonly needApi = inject(CourseNeedApiService);
  private readonly certApi = inject(CertificateApiService);
  private readonly templateApi = inject(CertificateTemplateApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly userApi = inject(UserApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly pdf = inject(PdfService);
  private readonly certPreview = inject(CertificatePreviewService);
  private readonly modal = inject(CrudModalService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);

  readonly statusColors = STATUS_COLOR;

  readonly courseId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly offeringId = toSignal(this.route.paramMap.pipe(map((p) => p.get('offeringId') ?? '')), { initialValue: '' });

  readonly activeTab = signal<Tab>('overview');
  readonly tabOptions = [
    { key: 'overview', label: 'Overview' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'roster', label: 'Roster' },
    { key: 'needs', label: 'Needs' },
    { key: 'certificates', label: 'Certificates' },
  ];
  selectTab = (key: string): void => {
    const tab = key as Tab;
    this.activeTab.set(tab);
    if (tab === 'roster') this.onRosterTabOpen();
    if (tab === 'certificates') this.onCertificatesTabOpen();
  };

  readonly course = signal<ApiCourse | null>(null);
  readonly offering = computed(() => this.offeringApi.offerings().find((o) => o.id === this.offeringId()) ?? null);
  readonly offeringLoading = this.offeringApi.loading;

  readonly effectiveStatusLabel = computed(() => {
    const o = this.offering();
    return o ? STATUS_LABEL[effectiveStatus(o)] : '';
  });
  readonly effectiveStatusColor = computed(() => {
    const o = this.offering();
    return o ? STATUS_COLOR[effectiveStatus(o)] : '';
  });
  readonly dateRangeLabel = computed(() => {
    const o = this.offering();
    return o ? `${formatDate(o.startDate)} – ${formatDate(o.endDate)}` : '';
  });

  private readonly branchOptions = computed(() => this.branchApi.branches().map((b) => ({ id: b.id, label: b.name })));
  private readonly instructors = computed(() => this.userApi.users().filter((u) => u.role === 'instructor'));
  private readonly instructorOptions = computed(() =>
    this.instructors().map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` })),
  );

  constructor() {
    this.offeringApi.load().subscribe();
    this.branchApi.load().subscribe();
    this.userApi.load().subscribe();

    // Angular reuses this component instance when navigating between two offerings (only the
    // :offeringId route param changes) — an effect keyed on courseId()/offeringId() re-runs this
    // load on every such navigation, not just on first construction, and resets tab-scoped state
    // so the new offering doesn't briefly show the previous one's session/roster selection.
    effect(() => {
      const courseId = this.courseId();
      const offeringId = this.offeringId();

      this.activeTab.set('overview');
      this.selectedSessionId.set('');
      this.sessions.set([]);
      this.qrOpen.set(false);

      if (courseId) {
        this.courseApi.getOne(courseId).subscribe({ next: (c) => this.course.set(c) });
        this.needApi.load(courseId).subscribe();
      }
      if (offeringId) {
        this.refreshSessions(offeringId);
        this.certApi.load(offeringId).subscribe();
        this.loadActiveTemplate();
      }
    });
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goCourse(): void {
    this.router.navigate(['/courses', this.courseId()]);
  }

  // =========================================================================
  // Overview tab
  // =========================================================================

  private offeringFields(): FieldDef[] {
    return [
      { key: 'code', label: 'Code / Nickname', type: 'text', hint: 'Optional — e.g. "Morning Batch". Shown on the public site.' },
      { key: 'branch', label: 'Branch', type: 'typeahead', relOptions: this.branchOptions() },
      { key: 'instructor', label: 'Instructor', type: 'typeahead', relOptions: this.instructorOptions(), hint: 'Optional' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'capacity', label: 'Capacity', type: 'number' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Onsite', 'Online'] },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ];
  }

  private toOfferingPayload(values: Record<string, string | number>): OfferingPayload {
    const payload: OfferingPayload = {
      courseId: this.courseId(),
      branchId: String(values['branch'] ?? '').trim(),
      startDate: String(values['startDate'] ?? ''),
      endDate: String(values['endDate'] ?? ''),
      mode: String(values['mode'] ?? 'Onsite').toLowerCase() as OfferingPayload['mode'],
      status: STATUS_TO_API[String(values['status'] ?? '')] ?? 'draft',
    };
    const code = String(values['code'] ?? '').trim();
    payload.code = code;
    const instructorId = String(values['instructor'] ?? '').trim();
    if (instructorId) payload.instructorId = instructorId;
    const location = String(values['location'] ?? '').trim();
    if (location) payload.location = location;
    const capacity = Number(values['capacity']);
    if (capacity > 0) payload.capacity = capacity;
    return payload;
  }

  /** Pre-save blocking conflict check (same instructor/branch, overlapping dates) with an
   * explicit "create anyway" override, instead of a toast fired after the save already happened. */
  private async confirmNoBlockingConflicts(values: Record<string, string | number>): Promise<boolean> {
    const start = new Date(String(values['startDate']));
    const end = new Date(String(values['endDate']));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;

    const instructorId = String(values['instructor'] ?? '').trim();
    const branchId = String(values['branch'] ?? '').trim();
    const selfId = this.offeringId();

    const conflicts = this.offeringApi.offerings().filter((o) => {
      if (o.id === selfId) return false;
      const oStart = new Date(o.startDate);
      const oEnd = new Date(o.endDate);
      const overlaps = start <= oEnd && oStart <= end;
      if (!overlaps) return false;
      return (!!instructorId && o.instructorId === instructorId) || o.branchId === branchId;
    });
    if (!conflicts.length) return true;

    const sameInstructor = conflicts.filter((c) => instructorId && c.instructorId === instructorId).map((c) => c.courseTitle);
    const sameBranchOnly = conflicts.filter((c) => !(instructorId && c.instructorId === instructorId)).map((c) => c.courseTitle);

    const parts: string[] = [];
    if (sameInstructor.length) parts.push(`Same instructor: ${sameInstructor.join(', ')}`);
    if (sameBranchOnly.length) parts.push(`Same branch: ${sameBranchOnly.join(', ')}`);

    return this.confirmSvc.ask(parts.join('. '), {
      title: 'Schedule Conflict',
      confirmLabel: 'Save Anyway',
      danger: false,
    });
  }

  editOverview(): void {
    const o = this.offering();
    if (!o) return;
    const ensureBranches: Observable<unknown> = this.branchApi.branches().length ? of(null) : this.branchApi.load();
    ensureBranches.subscribe(() => {
      this.modal.open({
        title: 'Edit Offering',
        fields: this.offeringFields(),
        isEdit: true,
        values: {
          code: o.code ?? '',
          branch: o.branchId,
          instructor: o.instructorId ?? '',
          startDate: o.startDate,
          endDate: o.endDate,
          capacity: o.capacity ?? 0,
          location: o.location ?? '',
          mode: o.mode === 'onsite' ? 'Onsite' : 'Online',
          status: STATUS_TO_OPTION[o.status],
        },
        onSave: (values) =>
          from(this.confirmNoBlockingConflicts(values)).pipe(
            switchMap((ok) => (ok ? this.offeringApi.update(o.id, this.toOfferingPayload(values)) : throwError(() => new Error('conflict-declined')))),
            tap({
              error: (err) => {
                if ((err as Error)?.message !== 'conflict-declined') this.showError(err, 'Failed to update offering.');
              },
            }),
          ),
      });
    });
  }

  // =========================================================================
  // Sessions tab
  // =========================================================================

  readonly sessions = signal<ApiCourseSession[]>([]);

  private refreshSessions(offeringId: string): void {
    this.offeringApi.listSessions(offeringId).subscribe({
      next: (rows) => this.sessions.set(rows),
      error: (err) => this.showError(err, 'Failed to load session calendar.'),
    });
  }

  private toSessionPayload(values: Record<string, string | number>): SessionPayload {
    const payload: SessionPayload = {
      sessionDate: String(values['sessionDate'] ?? ''),
      startTime: String(values['startTime'] ?? '').trim(),
      endTime: String(values['endTime'] ?? '').trim(),
    };
    const topic = String(values['topic'] ?? '').trim();
    const location = String(values['location'] ?? '').trim();
    if (topic) payload.topic = topic;
    if (location) payload.location = location;
    return payload;
  }

  addSession(): void {
    const offeringId = this.offeringId();
    if (!offeringId) return;
    this.modal.open({
      title: 'Add Session',
      fields: sessionFields(),
      isEdit: false,
      values: { sessionDate: '', startTime: '', endTime: '', topic: '', location: '' },
      onSave: (values) =>
        this.offeringApi.addSession(offeringId, this.toSessionPayload(values)).pipe(
          tap({
            next: () => this.refreshSessions(offeringId),
            error: (err) => this.showError(err, 'Failed to add session.'),
          }),
        ),
    });
  }

  editSession(session: ApiCourseSession): void {
    const offeringId = this.offeringId();
    if (!offeringId) return;
    this.modal.open({
      title: `Edit Session ${session.sessionNo}`,
      fields: sessionFields(),
      isEdit: true,
      values: {
        sessionDate: session.sessionDate,
        startTime: session.startTime.slice(0, 5),
        endTime: session.endTime.slice(0, 5),
        topic: session.topic ?? '',
        location: session.location ?? '',
      },
      onSave: (values) =>
        this.offeringApi.updateSession(offeringId, session.id, this.toSessionPayload(values)).pipe(
          tap({
            next: () => this.refreshSessions(offeringId),
            error: (err) => this.showError(err, 'Failed to update session.'),
          }),
        ),
      onDelete: () => this.removeSession(offeringId, session),
    });
  }

  private async removeSession(offeringId: string, session: ApiCourseSession): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.offeringApi.removeSession(offeringId, session.id).subscribe({
        next: () => {
          this.refreshSessions(offeringId);
          resolve();
        },
        error: (err) => {
          this.showError(err, 'Failed to delete session.');
          reject(err);
        },
      });
    });
  }

  async deleteSession(session: ApiCourseSession): Promise<void> {
    const offeringId = this.offeringId();
    if (!offeringId) return;
    const confirmed = await this.confirmSvc.ask(
      `Delete session ${session.sessionNo} (${session.sessionDate})? Any attendance recorded for it will be removed too.`,
      { title: 'Delete Session', confirmLabel: 'Delete', danger: true },
    );
    if (!confirmed) return;

    this.offeringApi.removeSession(offeringId, session.id).subscribe({
      next: () => {
        this.toast.show(`Session ${session.sessionNo} deleted.`, 'success');
        this.refreshSessions(offeringId);
      },
      error: (err) => this.showError(err, 'Failed to delete session.'),
    });
  }

  // =========================================================================
  // Roster tab (per-session view, same UX as the standalone Enrollment page)
  // =========================================================================

  readonly selectedSessionId = signal('');
  readonly selectedSession = computed(() => this.sessions().find((s) => s.id === this.selectedSessionId()) ?? null);
  readonly rosterLoading = this.enrollmentApi.loading;
  readonly rosterError = this.enrollmentApi.error;

  private readonly enrollmentRows = computed<EnrollmentRow[]>(() => this.enrollmentApi.enrollments().map(toEnrollmentRow));
  readonly roster = this.enrollmentRows;

  selectSession(sessionId: string): void {
    this.selectedSessionId.set(sessionId);
    if (sessionId) this.enrollmentApi.load(this.offeringId(), sessionId).subscribe();
  }

  /** Called once sessions load — defaults the roster to the next upcoming (or most recent) session. */
  private pickDefaultSession(): void {
    const rows = this.sessions();
    if (!rows.length || this.selectedSessionId()) return;
    const today = new Date().toISOString().slice(0, 10);
    const defaultSession = rows.find((s) => s.sessionDate >= today) ?? rows[rows.length - 1] ?? rows[0];
    if (defaultSession) this.selectSession(defaultSession.id);
  }

  onRosterTabOpen(): void {
    if (!this.selectedSessionId()) this.pickDefaultSession();
    else this.enrollmentApi.load(this.offeringId(), this.selectedSessionId()).subscribe();
  }

  toggleAttendance(row: EnrollmentRow): void {
    const offeringId = this.offeringId();
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

    this.enrollmentApi.removeEnrollment(this.offeringId(), row.userId, this.selectedSessionId()).subscribe({
      next: () => this.toast.show(`${row.name} was removed from this offering.`, 'success'),
      error: (err) => this.showError(err, 'Failed to remove enrollment.'),
    });
  }

  addStudent(): void {
    const enrolledIds = new Set(this.enrollmentRows().map((r) => r.userId));
    const candidates = this.userApi
      .users()
      .filter((u) => !enrolledIds.has(u.id))
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

  private enrollWithPrerequisiteOverride(userId: string): Observable<unknown> {
    const offeringId = this.offeringId();
    const sessionId = this.selectedSessionId();
    return this.enrollmentApi.enroll(offeringId, userId, sessionId).pipe(
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
            return this.enrollmentApi.enroll(offeringId, userId, sessionId, true);
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
    const offeringId = this.offeringId();
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

  /** Prints only #qr-print-area (course/session title + the QR itself) via a print stylesheet
   * that hides everything else — meant to be posted on a classroom wall for students to scan. */
  printQr(): void {
    window.print();
  }

  // =========================================================================
  // Needs tab (offering-scoped — the "whole course" option no longer applies)
  // =========================================================================

  readonly needsLoading = this.needApi.loading;
  readonly needsError = this.needApi.error;

  readonly needRows = computed<NeedRow[]>(() =>
    this.needApi
      .needs()
      .filter((n) => n.offeringId === this.offeringId())
      .map(toNeedRow),
  );

  private needSessionOptions(): string[] {
    const total = this.course()?.totalSessions ?? 0;
    return [WHOLE_COURSE, ...Array.from({ length: total }, (_, i) => `Session ${i + 1}`)];
  }

  private parseSessionNumber(value: string | number): number | undefined {
    const label = String(value ?? '').trim();
    if (!label || label === WHOLE_COURSE) return undefined;
    const match = /^Session (\d+)$/.exec(label);
    return match ? Number(match[1]) : undefined;
  }

  addNeed(): void {
    const courseId = this.courseId();
    const offeringId = this.offeringId();
    this.modal.open({
      title: 'Add Need',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'session', label: 'Session', type: 'select', options: this.needSessionOptions() },
        { key: 'type', label: 'Type', type: 'select', options: ['Goods', 'Money'] },
        { key: 'unit', label: 'Unit (e.g. bags, pieces) — goods only', type: 'text' },
        { key: 'targetQuantity', label: 'Target quantity', type: 'number', min: 0 },
      ],
      isEdit: false,
      values: { title: '', session: WHOLE_COURSE, type: 'Goods', unit: '', targetQuantity: 1 },
      onSave: (values) => {
        const type: ApiCourseNeedType = String(values['type']).toLowerCase() === 'money' ? 'money' : 'goods';
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const targetQuantity = Number(values['targetQuantity']);
        if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
          this.toast.show('Please enter a target quantity greater than 0.', 'error');
          return throwError(() => new Error('invalid-target-quantity'));
        }
        return this.needApi
          .create(courseId, {
            title,
            sessionNumber: this.parseSessionNumber(values['session']),
            offeringId,
            type,
            unit: type === 'goods' ? String(values['unit'] ?? '').trim() || undefined : undefined,
            targetQuantity,
          })
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to add need.') }));
      },
    });
  }

  editNeed(row: NeedRow): void {
    const courseId = this.courseId();
    const offeringId = this.offeringId();
    this.modal.open({
      title: 'Edit Need',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'session', label: 'Session', type: 'select', options: this.needSessionOptions() },
        { key: 'type', label: 'Type', type: 'select', options: ['Goods', 'Money'] },
        { key: 'unit', label: 'Unit (e.g. bags, pieces) — goods only', type: 'text' },
        { key: 'targetQuantity', label: 'Target quantity', type: 'number', min: 0 },
      ],
      isEdit: true,
      values: {
        title: row.title,
        session: row.sessionLabel,
        type: row.type === 'money' ? 'Money' : 'Goods',
        unit: row.unit ?? '',
        targetQuantity: row.target,
      },
      onSave: (values) => {
        const type: ApiCourseNeedType = String(values['type']).toLowerCase() === 'money' ? 'money' : 'goods';
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const targetQuantity = Number(values['targetQuantity']);
        if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
          this.toast.show('Please enter a target quantity greater than 0.', 'error');
          return throwError(() => new Error('invalid-target-quantity'));
        }
        return this.needApi
          .update(courseId, row.id, {
            title,
            sessionNumber: this.parseSessionNumber(values['session']),
            offeringId,
            type,
            unit: type === 'goods' ? String(values['unit'] ?? '').trim() || undefined : undefined,
            targetQuantity,
          })
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to update need.') }));
      },
      onDelete: () =>
        this.needApi.remove(courseId, row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete need.') })),
    });
  }

  // =========================================================================
  // Certificates tab
  // =========================================================================

  readonly activeTemplate = signal<ApiCertificateTemplate | null>(null);
  readonly templateLoaded = signal(false);
  readonly certLoading = this.certApi.loading;
  readonly certError = this.certApi.error;

  readonly certPassingPercent = computed(() => {
    const c = this.course();
    return c ? Number(c.passingAttendancePercent) : 80;
  });

  private readonly issuedByUserId = computed(() => {
    const map = new Map<string, { id: string; certNo: string; templateId: string; issuedAt: string; fileUrl: string }>();
    this.certApi.certificates().forEach((c) =>
      map.set(c.userId, { id: c.id, certNo: c.certificateNo, templateId: c.templateId, issuedAt: c.issuedAt, fileUrl: c.fileUrl }),
    );
    return map;
  });

  readonly certRows = computed<CertRow[]>(() => {
    const issuedMap = this.issuedByUserId();
    const passing = this.certPassingPercent();
    return this.enrollmentApi.enrollments().map((e) => {
      const eligible = e.attendancePercent >= passing;
      const issuedInfo = issuedMap.get(e.userId);
      const issued = !!issuedInfo;
      return {
        userId: e.userId,
        name: e.name,
        email: e.email,
        pctLabel: `${e.attendancePercent}%`,
        pctValue: e.attendancePercent,
        eligible,
        eligibleLabel: eligible ? 'Eligible' : 'Not yet',
        eligibleColor: eligible ? 'var(--w-green)' : 'var(--w-muted)',
        issued,
        certId: issuedInfo?.id ?? '',
        certNo: issuedInfo?.certNo ?? '—',
        templateId: issuedInfo?.templateId ?? '',
        issuedAt: issuedInfo?.issuedAt ?? '',
        fileUrl: issuedInfo?.fileUrl ?? '',
        issueLabel: issued ? 'Issued' : eligible ? 'Ready to issue' : '—',
        actionIcon: issued ? '⤓' : eligible ? '◈' : '—',
        actionColor: issued || eligible ? 'var(--w-accent)' : '#c9bfa8',
      };
    });
  });

  onCertificatesTabOpen(): void {
    const offeringId = this.offeringId();
    if (!offeringId) return;
    // Roster data (attendance %) drives eligibility — make sure it's loaded regardless of which
    // session the Roster tab currently has selected.
    this.enrollmentApi.load(offeringId).subscribe();
    this.certApi.load(offeringId).subscribe();
  }

  private loadActiveTemplate(): void {
    this.templateLoaded.set(false);
    const branchId = this.offering()?.branchId ?? null;
    this.templateApi.findActiveForBranch(branchId).subscribe({
      next: (template) => {
        this.activeTemplate.set(template);
        this.templateLoaded.set(true);
      },
      error: () => {
        this.activeTemplate.set(null);
        this.templateLoaded.set(true);
      },
    });
  }

  private issueOne(row: CertRow) {
    const offering = this.offering();
    const template = this.activeTemplate();
    if (!offering || !template) return of(false);

    const certificateNo = `WPI-CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return from(
      this.pdf.certificateFromTemplateDataUri({
        backgroundImageUrl: template.backgroundImageUrl,
        layoutConfig: template.layoutConfig,
        recipientName: row.name,
        courseLine: offering.courseTitle,
        certificateNo,
        issueDate,
      }),
    ).pipe(
      switchMap((dataUri) => this.uploads.uploadDataUri(dataUri)),
      switchMap((fileUrl) => this.certApi.issue({ offeringId: offering.id, userId: row.userId, fileUrl, certificateNo })),
      map(() => true),
      catchError((err) => {
        this.showError(err, `Failed to issue certificate for ${row.name}.`);
        return of(false);
      }),
    );
  }

  viewCertificate(row: CertRow): void {
    const offering = this.offering();
    if (!offering) return;
    if (!row.templateId) {
      this.toast.show('This certificate predates template tracking and can’t be previewed — void it, then re-issue to enable preview.', 'error');
      return;
    }

    this.templateApi.getOne(row.templateId).subscribe({
      next: (template) => {
        const issueDate = row.issuedAt
          ? new Date(row.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '';
        this.certPreview.ask(
          {
            backgroundImageUrl: template.backgroundImageUrl,
            layoutConfig: template.layoutConfig,
            recipientName: row.name,
            detailLine: offering.courseTitle,
            certificateNo: row.certNo,
            issueDate,
          },
          { title: `Certificate for ${row.name}`, confirmLabel: 'Close', viewOnly: true },
        );
      },
      error: (err) => this.showError(err, 'Failed to load the certificate template.'),
    });
  }

  async voidCertificate(row: CertRow): Promise<void> {
    if (!row.certId) return;
    const offering = this.offering();
    const confirmed = await this.confirmSvc.ask(`Void the certificate for ${row.name}? You can issue a new one afterward.`, {
      title: 'Void certificate',
      confirmLabel: 'Void',
      danger: true,
    });
    if (!confirmed) return;

    this.certApi.remove(row.certId, offering?.id).subscribe({
      next: () => this.toast.show(`Certificate for ${row.name} voided.`, 'success'),
      error: (err) => this.showError(err, 'Failed to void certificate.'),
    });
  }

  toggleCertificate(row: CertRow): void {
    if (row.issued || !row.eligible) return;
    const offering = this.offering();
    const template = this.activeTemplate();
    if (!offering || !template) {
      this.toast.show('No active certificate template is configured for this branch — set one up in Certificate Templates.', 'error');
      return;
    }

    const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    this.certApi.nextNumber().subscribe({
      next: ({ certificateNo }) => this.showIssuePreview(row, offering, template, certificateNo, issueDate),
      error: (err) => this.showError(err, 'Failed to reserve a certificate number.'),
    });
  }

  private showIssuePreview(
    row: CertRow,
    offering: ApiOffering,
    template: ApiCertificateTemplate,
    certificateNo: string,
    issueDate: string,
  ): void {
    this.certPreview
      .ask(
        {
          backgroundImageUrl: template.backgroundImageUrl,
          layoutConfig: template.layoutConfig,
          recipientName: row.name,
          detailLine: offering.courseTitle,
          certificateNo,
          issueDate,
        },
        { title: `Certificate for ${row.name}` },
      )
      .then(async (confirmed) => {
        if (!confirmed) return;

        const dataUri = await this.pdf.certificateFromTemplateDataUri({
          backgroundImageUrl: template.backgroundImageUrl,
          layoutConfig: template.layoutConfig,
          recipientName: row.name,
          courseLine: offering.courseTitle,
          certificateNo,
          issueDate,
        });

        this.uploads
          .uploadDataUri(dataUri)
          .pipe(
            switchMap((fileUrl) => this.certApi.issue({ offeringId: offering.id, userId: row.userId, fileUrl, certificateNo })),
            catchError((err) => {
              this.showError(err, `Failed to issue certificate for ${row.name}.`);
              return of(null);
            }),
          )
          .subscribe((res) => {
            if (res) this.toast.show(`Certificate issued to ${row.name}.`, 'success');
          });
      });
  }

  bulkIssue(): void {
    if (!this.activeTemplate()) {
      this.toast.show('No active certificate template is configured for this branch — set one up in Certificate Templates.', 'error');
      return;
    }
    const eligibleRows = this.certRows().filter((r) => r.eligible && !r.issued);
    if (!eligibleRows.length) {
      this.toast.show('No newly eligible students to issue.', 'info');
      return;
    }

    from(eligibleRows)
      .pipe(
        concatMap((row) => this.issueOne(row)),
        map((ok) => (ok ? 1 : 0)),
      )
      .subscribe({
        next: () => {},
        complete: () => {
          this.toast.show(`Finished issuing certificates for ${eligibleRows.length} eligible student(s).`, 'success');
        },
      });
  }
}
