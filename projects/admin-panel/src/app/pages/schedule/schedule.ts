import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, of, switchMap, tap, throwError } from 'rxjs';
import { CourseApiService } from '../../core/services/course-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { ApiOffering, ApiOfferingStatus, OfferingApiService, OfferingPayload } from '../../core/services/offering-api.service';
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

/**
 * Cross-course directory of every offering — the one place to browse/search offerings without
 * already knowing which course they belong to. Actually managing an offering (sessions, roster,
 * needs, certificates, editing its own fields) all happens in the Offering Workspace now; this
 * page only browses and creates, so there's exactly one place that edits an offering, not two.
 */
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

  goWorkspace(row: OfferingRow): void {
    this.router.navigate(['/courses', row.courseId, 'offerings', row.id]);
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

  private checkConflicts(values: Record<string, string | number>): OfferingRow[] {
    const start = new Date(String(values['startDate']));
    const end = new Date(String(values['endDate']));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    const instructorId = String(values['instructor'] ?? '').trim();
    const branchId = String(values['branch'] ?? '').trim();

    return this.rows().filter((o) => {
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
  private async confirmNoBlockingConflicts(values: Record<string, string | number>): Promise<boolean> {
    const conflicts = this.checkConflicts(values);
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
          from(this.confirmNoBlockingConflicts(values)).pipe(
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
}
