import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, from, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiCourse, CourseApiService } from '../../core/services/course-api.service';
import {
  ApiCourseSession,
  ApiOffering,
  ApiOfferingStatus,
  OfferingApiService,
  OfferingPayload,
  SessionPayload,
} from '../../core/services/offering-api.service';
import { ApiCourseNeed, ApiCourseNeedType, CourseNeedApiService } from '../../core/services/course-need-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';
import { FilterTabs } from '../../shared/filter-tabs/filter-tabs';
import { FieldDef } from '../../core/models/admin.models';

type Tab = 'overview' | 'sessions' | 'needs';

const WHOLE_COURSE = 'Not session-specific';

/** Every 15 minutes across the day, e.g. '00:00', '00:15', ... '23:45' — for the Start/End time
 * dropdowns, so admins pick a time instead of typing HH:mm by hand. */
function timeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

/** extraTimes ensures an existing session's saved time is selectable even if it falls off the
 * 15-minute grid (e.g. an odd time from before this was a dropdown) — otherwise the <select>'s
 * bound value would match no <option> and silently render blank. */
function sessionFields(extraTimes: string[] = []): FieldDef[] {
  const times = Array.from(new Set([...timeOptions(), ...extraTimes])).sort();
  return [
    { key: 'sessionDate', label: 'Session date', type: 'date' },
    { key: 'startTime', label: 'Start time', type: 'select', options: times },
    { key: 'endTime', label: 'End time', type: 'select', options: times },
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

@Component({
  selector: 'app-offering-workspace',
  imports: [FormsModule, FilterTabs],
  templateUrl: './offering-workspace.html',
  styleUrl: './offering-workspace.scss',
})
export class OfferingWorkspace {
  private readonly courseApi = inject(CourseApiService);
  private readonly offeringApi = inject(OfferingApiService);
  private readonly needApi = inject(CourseNeedApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly userApi = inject(UserApiService);
  private readonly modal = inject(CrudModalService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);

  readonly statusColors = STATUS_COLOR;

  readonly courseId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly offeringId = toSignal(this.route.paramMap.pipe(map((p) => p.get('offeringId') ?? '')), { initialValue: '' });
  /** Lets a link jump straight into a specific tab, e.g. ?tab=needs — instead of always landing
   * on Overview. */
  private readonly initialTabParam = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('tab') ?? '')), {
    initialValue: '',
  });

  readonly activeTab = signal<Tab>('overview');
  readonly tabOptions = [
    { key: 'overview', label: 'Overview' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'needs', label: 'Needs' },
  ];
  selectTab = (key: string): void => {
    this.activeTab.set(key as Tab);
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
    // so the new offering doesn't briefly show the previous one's session list.
    effect(() => {
      const courseId = this.courseId();
      const offeringId = this.offeringId();
      const initialTab = this.initialTabParam();

      this.sessions.set([]);
      const tab: Tab = this.tabOptions.some((t) => t.key === initialTab) ? (initialTab as Tab) : 'overview';
      this.activeTab.set(tab);

      if (courseId) {
        this.courseApi.getOne(courseId).subscribe({ next: (c) => this.course.set(c) });
        this.needApi.load(courseId).subscribe();
      }
      if (offeringId) {
        this.refreshSessions(offeringId);
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

  goEnrollment(): void {
    this.router.navigate(['/enrollment'], { queryParams: { offeringId: this.offeringId() } });
  }

  goCertificates(): void {
    this.router.navigate(['/certificates'], { queryParams: { offeringId: this.offeringId() } });
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
      values: { sessionDate: '', startTime: '18:00', endTime: '20:00', topic: '', location: '' },
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
    const startTime = session.startTime.slice(0, 5);
    const endTime = session.endTime.slice(0, 5);
    this.modal.open({
      title: `Edit Session ${session.sessionNo}`,
      fields: sessionFields([startTime, endTime]),
      isEdit: true,
      values: {
        sessionDate: session.sessionDate,
        startTime,
        endTime,
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

}
