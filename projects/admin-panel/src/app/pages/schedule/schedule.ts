import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, of, switchMap, tap, throwError } from 'rxjs';
import { CourseApiService } from '../../core/services/course-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import {
  ApiCourseSession,
  ApiOffering,
  ApiOfferingStatus,
  OfferingApiService,
  OfferingPayload,
  SessionPayload,
} from '../../core/services/offering-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FieldDef } from '../../core/models/admin.models';

interface OfferingRow {
  id: string;
  courseId: string;
  courseTitle: string;
  branchId: string;
  branchName: string;
  instructorId: string | null;
  instructorName: string;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  capacity: number;
  location: string;
  enrolledCount: number;
  modeLabel: string;
  statusKey: ApiOfferingStatus;
  statusLabel: string;
  statusColor: string;
  totalSessions: number;
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

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toRow(o: ApiOffering): OfferingRow {
  return {
    id: o.id,
    courseId: o.courseId,
    courseTitle: o.courseTitle,
    branchId: o.branchId,
    branchName: o.branchName,
    instructorId: o.instructorId,
    instructorName: o.instructorName ?? 'Unassigned',
    startDate: o.startDate,
    endDate: o.endDate,
    dateRangeLabel: `${formatDate(o.startDate)} – ${formatDate(o.endDate)}`,
    capacity: o.capacity ?? 0,
    location: o.location ?? '',
    enrolledCount: o.enrolledCount,
    modeLabel: o.mode === 'onsite' ? 'Onsite' : 'Online',
    statusKey: o.status,
    statusLabel: STATUS_LABEL[o.status],
    statusColor: STATUS_COLOR[o.status],
    totalSessions: o.totalSessions,
  };
}

export function sessionFields(): FieldDef[] {
  return [
    { key: 'sessionDate', label: 'Session date', type: 'date' },
    { key: 'startTime', label: 'Start time', type: 'text', hint: '24-hour HH:mm, e.g. 18:00' },
    { key: 'endTime', label: 'End time', type: 'text', hint: '24-hour HH:mm, e.g. 20:00' },
    { key: 'topic', label: 'Topic', type: 'text', hint: 'Optional' },
    { key: 'location', label: 'Location', type: 'text', hint: 'Optional — defaults to the offering location' },
  ];
}

function buildFields(
  courseOptions: { id: string; label: string }[],
  branchOptions: { id: string; label: string }[],
  instructorOptions: { id: string; label: string }[],
): FieldDef[] {
  return [
    { key: 'course', label: 'Course', type: 'typeahead', relOptions: courseOptions },
    { key: 'branch', label: 'Branch', type: 'typeahead', relOptions: branchOptions },
    { key: 'instructor', label: 'Instructor', type: 'typeahead', relOptions: instructorOptions, hint: 'Optional' },
    { key: 'startDate', label: 'Start date', type: 'date' },
    { key: 'endDate', label: 'End date', type: 'date' },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'mode', label: 'Mode', type: 'select', options: ['Onsite', 'Online'] },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  ];
}

@Component({
  selector: 'app-schedule',
  imports: [TableToolbar],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule {
  private readonly api = inject(OfferingApiService);
  private readonly courseApi = inject(CourseApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly userApi = inject(UserApiService);
  private readonly modal = inject(CrudModalService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;
  readonly statusColors = STATUS_COLOR;

  private readonly courseOptions = computed(() => this.courseApi.courses().map((c) => ({ id: c.id, label: c.title })));
  private readonly branchOptions = computed(() => this.branchApi.branches().map((b) => ({ id: b.id, label: b.name })));
  private readonly instructors = computed(() => this.userApi.users().filter((u) => u.role === 'instructor'));
  private readonly instructorOptions = computed(() =>
    this.instructors().map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` })),
  );

  private readonly rows = computed<OfferingRow[]>(() => this.api.offerings().map(toRow));

  readonly ctrl = new ListController<OfferingRow>(this.rows);

  readonly selectedOfferingId = signal('');
  readonly sessions = signal<ApiCourseSession[]>([]);

  readonly selectedOffering = computed(() => this.rows().find((r) => r.id === this.selectedOfferingId()) ?? null);

  constructor() {
    this.api.load().subscribe();
    this.courseApi.load().subscribe();
    this.branchApi.load().subscribe();
    this.userApi.load().subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goEnrollment(row: OfferingRow): void {
    this.router.navigate(['/enrollment'], { queryParams: { offeringId: row.id } });
  }

  viewSessions(row: OfferingRow): void {
    this.selectedOfferingId.set(row.id);
    this.refreshSessions(row.id);
  }

  private refreshSessions(offeringId: string): void {
    this.api.listSessions(offeringId).subscribe({
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
    const offeringId = this.selectedOfferingId();
    if (!offeringId) return;

    this.modal.open({
      title: 'Add Session',
      fields: sessionFields(),
      isEdit: false,
      values: { sessionDate: '', startTime: '', endTime: '', topic: '', location: '' },
      onSave: (values) =>
        this.api.addSession(offeringId, this.toSessionPayload(values)).pipe(
          tap({
            next: () => this.refreshSessions(offeringId),
            error: (err) => this.showError(err, 'Failed to add session.'),
          }),
        ),
    });
  }

  editSession(session: ApiCourseSession): void {
    const offeringId = this.selectedOfferingId();
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
        this.api.updateSession(offeringId, session.id, this.toSessionPayload(values)).pipe(
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
      this.api.removeSession(offeringId, session.id).subscribe({
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
    const offeringId = this.selectedOfferingId();
    if (!offeringId) return;

    const confirmed = await this.confirmSvc.ask(
      `Delete session ${session.sessionNo} (${session.sessionDate})? Any attendance recorded for it will be removed too.`,
      { title: 'Delete Session', confirmLabel: 'Delete', danger: true },
    );
    if (!confirmed) return;

    this.api.removeSession(offeringId, session.id).subscribe({
      next: () => {
        this.toast.show(`Session ${session.sessionNo} deleted.`, 'success');
        this.refreshSessions(offeringId);
      },
      error: (err) => this.showError(err, 'Failed to delete session.'),
    });
  }

  private toPayload(values: Record<string, string | number>): OfferingPayload {
    const courseId = String(values['course'] ?? '').trim();
    const branchId = String(values['branch'] ?? '').trim();
    const instructorId = String(values['instructor'] ?? '').trim();

    const payload: OfferingPayload = {
      courseId,
      branchId,
      startDate: String(values['startDate'] ?? ''),
      endDate: String(values['endDate'] ?? ''),
      mode: String(values['mode'] ?? 'Onsite').toLowerCase() as OfferingPayload['mode'],
      status: STATUS_TO_API[String(values['status'] ?? '')] ?? 'draft',
    };

    if (instructorId) payload.instructorId = instructorId;
    const location = String(values['location'] ?? '').trim();
    if (location) payload.location = location;
    const capacity = Number(values['capacity']);
    if (capacity > 0) payload.capacity = capacity;

    return payload;
  }

  private checkConflicts(values: Record<string, string | number>, excludingId: string | null): OfferingRow[] {
    const start = new Date(String(values['startDate']));
    const end = new Date(String(values['endDate']));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    const instructorId = String(values['instructor'] ?? '').trim();
    const branchId = String(values['branch'] ?? '').trim();

    return this.rows().filter((o) => {
      if (o.id === excludingId) return false;
      const oStart = new Date(o.startDate);
      const oEnd = new Date(o.endDate);
      const overlaps = start <= oEnd && oStart <= end;
      if (!overlaps) return false;
      return (!!instructorId && o.instructorId === instructorId) || o.branchId === branchId;
    });
  }

  /** Blocking pre-save conflict check — instead of a toast fired after the save already went through,
   * this asks for an explicit "create anyway" before the API call happens at all. Resolves false if the
   * admin declines, in which case the caller should abort the save. */
  private async confirmNoBlockingConflicts(values: Record<string, string | number>, excludingId: string | null): Promise<boolean> {
    const conflicts = this.checkConflicts(values, excludingId);
    if (!conflicts.length) return true;

    const instructorId = String(values['instructor'] ?? '').trim();
    const lines = conflicts
      .map((c) => {
        const reason = instructorId && c.instructorId === instructorId ? 'same instructor' : 'same branch';
        return `"${c.courseTitle}" (${c.branchName} · ${c.instructorName}, ${c.dateRangeLabel}) — ${reason}`;
      })
      .join('; ');

    return this.confirmSvc.ask(`Schedule conflict: overlaps with ${lines}.`, {
      title: 'Schedule Conflict',
      confirmLabel: 'Create Anyway',
      danger: false,
    });
  }

  /** The 'branch' picker's options are a static snapshot taken when the modal opens — make sure
   * branches have actually loaded first, so a fast click right after navigating here doesn't open
   * the modal with an empty branch list. */
  private ensureBranchesLoaded(): Observable<unknown> {
    return this.branchApi.branches().length ? of(null) : this.branchApi.load();
  }

  addOffering(): void {
    this.ensureBranchesLoaded().subscribe(() => {
      this.modal.open({
        title: 'Add Class Offering',
        fields: buildFields(this.courseOptions(), this.branchOptions(), this.instructorOptions()),
        isEdit: false,
        values: {
          course: this.courseOptions()[0]?.id ?? '',
          branch: this.branchOptions()[0]?.id ?? '',
          instructor: '',
          startDate: '',
          endDate: '',
          capacity: 20,
          location: '',
          mode: 'Onsite',
          status: 'Draft',
        },
        onSave: (values) =>
          from(this.confirmNoBlockingConflicts(values, null)).pipe(
            switchMap((ok) => (ok ? this.api.create(this.toPayload(values)) : throwError(() => new Error('conflict-declined')))),
            tap({
              error: (err) => {
                if ((err as Error)?.message !== 'conflict-declined') this.showError(err, 'Failed to create offering.');
              },
            }),
          ),
      });
    });
  }

  editOffering(row: OfferingRow): void {
    this.ensureBranchesLoaded().subscribe(() => {
      this.modal.open({
        title: 'Edit Class Offering',
        fields: buildFields(this.courseOptions(), this.branchOptions(), this.instructorOptions()),
        isEdit: true,
        values: {
          course: row.courseId,
          branch: row.branchId,
          instructor: row.instructorId ?? '',
          startDate: row.startDate,
          endDate: row.endDate,
          capacity: row.capacity,
          location: row.location,
          mode: row.modeLabel,
          status: row.statusLabel,
        },
        onSave: (values) =>
          from(this.confirmNoBlockingConflicts(values, row.id)).pipe(
            switchMap((ok) => (ok ? this.api.update(row.id, this.toPayload(values)) : throwError(() => new Error('conflict-declined')))),
            tap({
              error: (err) => {
                if ((err as Error)?.message !== 'conflict-declined') this.showError(err, 'Failed to update offering.');
              },
            }),
          ),
        onDelete: () =>
          this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete offering.') })),
      });
    });
  }
}
