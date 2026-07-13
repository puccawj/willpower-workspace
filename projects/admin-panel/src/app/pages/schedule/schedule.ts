import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { CourseApiService } from '../../core/services/course-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import {
  ApiCourseSession,
  ApiOffering,
  ApiOfferingStatus,
  OfferingApiService,
  OfferingPayload,
} from '../../core/services/offering-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
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
}

const STATUS_COLOR: Record<ApiOfferingStatus, string> = {
  draft: 'var(--w-muted)',
  scheduled: 'var(--w-green)',
  ongoing: 'var(--w-gold)',
  completed: 'var(--w-ink-soft)',
  cancelled: 'var(--w-red)',
};

const STATUS_OPTIONS = ['Draft', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
const STATUS_TO_API: Record<string, ApiOfferingStatus> = {
  Draft: 'draft',
  Scheduled: 'scheduled',
  Ongoing: 'ongoing',
  Completed: 'completed',
  Cancelled: 'cancelled',
};
const STATUS_LABEL: Record<ApiOfferingStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
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
  };
}

function buildFields(courseTitles: string[], branchNames: string[], instructorNames: string[]): FieldDef[] {
  return [
    { key: 'course', label: 'Course', type: 'combobox', options: courseTitles },
    { key: 'branch', label: 'Branch', type: 'combobox', options: branchNames },
    { key: 'instructor', label: 'Instructor', type: 'combobox', options: instructorNames },
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
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;
  readonly statusColors = STATUS_COLOR;

  private readonly courseNames = computed(() => this.courseApi.courses().map((c) => c.title));
  private readonly courseNameToId = computed(() => {
    const map = new Map<string, string>();
    this.courseApi.courses().forEach((c) => map.set(c.title.toLowerCase(), c.id));
    return map;
  });

  private readonly branchNames = computed(() => this.branchApi.branches().map((b) => b.name));
  private readonly branchNameToId = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.name.toLowerCase(), b.id));
    return map;
  });

  private readonly instructors = computed(() => this.userApi.users().filter((u) => u.role === 'instructor'));
  private readonly instructorNames = computed(() => this.instructors().map((u) => `${u.firstName} ${u.lastName}`));
  private readonly instructorNameToId = computed(() => {
    const map = new Map<string, string>();
    this.instructors().forEach((u) => map.set(`${u.firstName} ${u.lastName}`.toLowerCase(), u.id));
    return map;
  });

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
    this.api.listSessions(row.id).subscribe({
      next: (rows) => this.sessions.set(rows),
      error: (err) => this.showError(err, 'Failed to load session calendar.'),
    });
  }

  private toPayload(values: Record<string, string | number>): OfferingPayload {
    const courseId = this.courseNameToId().get(String(values['course'] ?? '').trim().toLowerCase()) ?? '';
    const branchId = this.branchNameToId().get(String(values['branch'] ?? '').trim().toLowerCase()) ?? '';
    const instructorName = String(values['instructor'] ?? '').trim();
    const instructorId = instructorName ? this.instructorNameToId().get(instructorName.toLowerCase()) : undefined;

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

  private warnConflicts(values: Record<string, string | number>, excludingId: string | null): void {
    const start = new Date(String(values['startDate']));
    const end = new Date(String(values['endDate']));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const instructorName = String(values['instructor'] ?? '').trim().toLowerCase();
    const branchName = String(values['branch'] ?? '').trim().toLowerCase();

    const conflicts = this.rows().filter((o) => {
      if (o.id === excludingId) return false;
      const oStart = new Date(o.startDate);
      const oEnd = new Date(o.endDate);
      const overlaps = start <= oEnd && oStart <= end;
      if (!overlaps) return false;
      return o.instructorName.toLowerCase() === instructorName || o.branchName.toLowerCase() === branchName;
    });

    conflicts.forEach((c) => {
      const reason = c.instructorName.toLowerCase() === instructorName ? 'same instructor' : 'same branch';
      this.toast.show(
        `Schedule conflict: overlaps with "${c.courseTitle}" (${c.branchName} · ${c.instructorName}, ${c.dateRangeLabel}) — ${reason}.`,
        'warning',
        6000,
      );
    });
  }

  addOffering(): void {
    this.modal.open({
      title: 'Add Class Offering',
      fields: buildFields(this.courseNames(), this.branchNames(), this.instructorNames()),
      isEdit: false,
      values: {
        course: this.courseNames()[0] ?? '',
        branch: '',
        instructor: '',
        startDate: '',
        endDate: '',
        capacity: 20,
        location: '',
        mode: 'Onsite',
        status: 'Draft',
      },
      onSave: (values) => {
        this.warnConflicts(values, null);
        return this.api.create(this.toPayload(values)).pipe(tap({ error: (err) => this.showError(err, 'Failed to create offering.') }));
      },
    });
  }

  editOffering(row: OfferingRow): void {
    this.modal.open({
      title: 'Edit Class Offering',
      fields: buildFields(this.courseNames(), this.branchNames(), this.instructorNames()),
      isEdit: true,
      values: {
        course: row.courseTitle,
        branch: row.branchName,
        instructor: row.instructorName === 'Unassigned' ? '' : row.instructorName,
        startDate: row.startDate,
        endDate: row.endDate,
        capacity: row.capacity,
        location: row.location,
        mode: row.modeLabel,
        status: row.statusLabel,
      },
      onSave: (values) => {
        this.warnConflicts(values, row.id);
        return this.api.update(row.id, this.toPayload(values)).pipe(tap({ error: (err) => this.showError(err, 'Failed to update offering.') }));
      },
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete offering.') })),
    });
  }
}
