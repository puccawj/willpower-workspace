import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, switchMap, tap, throwError } from 'rxjs';
import { CourseApiService } from '../../core/services/course-api.service';
import { ApiOffering, ApiOfferingStatus, OfferingApiService, OfferingPayload } from '../../core/services/offering-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FieldDef } from '../../core/models/admin.models';

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

interface OfferingRow {
  id: string;
  code: string | null;
  courseId: string;
  courseTitle: string;
  courseActive: boolean;
  branchId: string;
  branchName: string;
  instructorId: string | null;
  instructorName: string;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  capacity: number;
  location: string;
  mode: string;
  modeLabel: string;
  enrolledCount: number;
  statusKey: ApiOfferingStatus;
  statusLabel: string;
  statusColor: string;
}

function toRow(o: ApiOffering): OfferingRow {
  return {
    id: o.id,
    code: o.code,
    courseId: o.courseId,
    courseTitle: o.courseTitle,
    courseActive: o.courseStatus === 'active',
    branchId: o.branchId,
    branchName: o.branchName,
    instructorId: o.instructorId,
    instructorName: o.instructorName ?? 'Unassigned',
    startDate: o.startDate,
    endDate: o.endDate,
    dateRangeLabel: `${formatDate(o.startDate)} – ${formatDate(o.endDate)}`,
    capacity: o.capacity ?? 0,
    location: o.location ?? '',
    mode: o.mode,
    modeLabel: o.mode === 'onsite' ? 'Onsite' : 'Online',
    enrolledCount: o.enrolledCount,
    statusKey: o.status,
    statusLabel: STATUS_LABEL[o.status],
    statusColor: STATUS_COLOR[o.status],
  };
}

@Component({
  selector: 'app-all-offerings',
  imports: [TableToolbar],
  templateUrl: './all-offerings.html',
  styleUrl: './all-offerings.scss',
})
export class AllOfferings {
  private readonly offeringApi = inject(OfferingApiService);
  private readonly courseApi = inject(CourseApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly userApi = inject(UserApiService);
  private readonly modal = inject(CrudModalService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);
  readonly statusColors = STATUS_COLOR;

  readonly loading = this.offeringApi.loading;
  readonly error = this.offeringApi.error;

  private readonly courseOptions = computed(() => this.courseApi.courses().map((c) => ({ id: c.id, label: c.title })));
  private readonly branchOptions = computed(() => this.branchApi.branches().map((b) => ({ id: b.id, label: b.name })));
  private readonly instructors = computed(() => this.userApi.users().filter((u) => u.role === 'instructor'));
  private readonly instructorOptions = computed(() =>
    this.instructors().map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` })),
  );

  private readonly rows = computed<OfferingRow[]>(() =>
    this.offeringApi
      .offerings()
      .map(toRow)
      .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.startDate.localeCompare(b.startDate)),
  );

  readonly ctrl = new ListController<OfferingRow>(this.rows);

  constructor() {
    this.offeringApi.load().subscribe();
    this.courseApi.load().subscribe();
    this.branchApi.load().subscribe();
    this.userApi.load().subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goWorkspace(row: OfferingRow): void {
    this.router.navigate(['/courses', row.courseId, 'offerings', row.id]);
  }

  goEnrollment(row: OfferingRow): void {
    this.router.navigate(['/courses', row.courseId, 'offerings', row.id], { queryParams: { tab: 'roster' } });
  }

  private offeringFields(excludeCourseSelect = false): FieldDef[] {
    const fields: FieldDef[] = [];
    if (!excludeCourseSelect) fields.push({ key: 'course', label: 'Course', type: 'typeahead', relOptions: this.courseOptions() });
    fields.push(
      { key: 'code', label: 'Code / Nickname', type: 'text', hint: 'Optional — e.g. "Morning Batch". Shown on the public site.' },
      { key: 'branch', label: 'Branch', type: 'typeahead', relOptions: this.branchOptions() },
      { key: 'instructor', label: 'Instructor', type: 'typeahead', relOptions: this.instructorOptions(), hint: 'Optional' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'capacity', label: 'Capacity', type: 'number' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Onsite', 'Online'] },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    );
    return fields;
  }

  private toPayload(courseId: string, values: Record<string, string | number>): OfferingPayload {
    const payload: OfferingPayload = {
      courseId,
      branchId: String(values['branch'] ?? '').trim(),
      startDate: String(values['startDate'] ?? ''),
      endDate: String(values['endDate'] ?? ''),
      mode: String(values['mode'] ?? 'Onsite').toLowerCase() as OfferingPayload['mode'],
      status: STATUS_TO_API[String(values['status'] ?? '')] ?? 'draft',
    };
    payload.code = String(values['code'] ?? '').trim();
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
  private async confirmNoBlockingConflicts(values: Record<string, string | number>, selfId?: string): Promise<boolean> {
    const start = new Date(String(values['startDate']));
    const end = new Date(String(values['endDate']));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;

    const instructorId = String(values['instructor'] ?? '').trim();
    const branchId = String(values['branch'] ?? '').trim();

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

  addOffering(): void {
    this.modal.open({
      title: 'New Offering',
      fields: this.offeringFields(),
      isEdit: false,
      values: {
        course: this.courseOptions()[0]?.id ?? '',
        code: '',
        branch: this.branchOptions()[0]?.id ?? '',
        instructor: '',
        startDate: '',
        endDate: '',
        capacity: 20,
        location: '',
        mode: 'Onsite',
        status: 'Draft',
      },
      onSave: (values) => {
        const courseId = String(values['course'] ?? '').trim();
        if (!courseId) return throwError(() => new Error('Please choose a course.'));
        return from(this.confirmNoBlockingConflicts(values)).pipe(
          switchMap((ok) => (ok ? this.offeringApi.create(this.toPayload(courseId, values)) : throwError(() => new Error('conflict-declined')))),
          tap({
            error: (err) => {
              if ((err as Error)?.message !== 'conflict-declined') this.showError(err, 'Failed to create offering.');
            },
          }),
        );
      },
    });
  }

  editOffering(row: OfferingRow): void {
    this.modal.open({
      title: 'Edit Offering',
      fields: this.offeringFields(),
      isEdit: true,
      values: {
        course: row.courseId,
        code: row.code ?? '',
        branch: row.branchId,
        instructor: row.instructorId ?? '',
        startDate: row.startDate,
        endDate: row.endDate,
        capacity: row.capacity,
        location: row.location,
        mode: row.mode === 'onsite' ? 'Onsite' : 'Online',
        status: STATUS_TO_OPTION[row.statusKey],
      },
      onSave: (values) => {
        const courseId = String(values['course'] ?? '').trim() || row.courseId;
        return from(this.confirmNoBlockingConflicts(values, row.id)).pipe(
          switchMap((ok) => (ok ? this.offeringApi.update(row.id, this.toPayload(courseId, values)) : throwError(() => new Error('conflict-declined')))),
          tap({
            error: (err) => {
              if ((err as Error)?.message !== 'conflict-declined') this.showError(err, 'Failed to update offering.');
            },
          }),
        );
      },
      onDelete: () =>
        this.offeringApi.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete offering.') })),
    });
  }
}
