import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiOffering, ApiOfferingStatus, OfferingApiService } from '../../core/services/offering-api.service';
import { RoleService } from '../../core/services/role.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';

interface OfferingRow {
  id: string;
  courseId: string;
  courseTitle: string;
  branchName: string;
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
    branchName: o.branchName,
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

/**
 * Cross-course directory of every offering — the one place to browse/search offerings without
 * already knowing which course they belong to. Creating and actually managing an offering
 * (sessions, roster, needs, certificates, editing its own fields) all happens from Manage Course
 * → Course Overview → Offering Workspace now, so this page is browse-only.
 */
@Component({
  selector: 'app-schedule',
  imports: [TableToolbar],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule {
  private readonly api = inject(OfferingApiService);
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;
  readonly statusColors = STATUS_COLOR;

  private readonly rows = computed<OfferingRow[]>(() => this.api.offerings().map(toRow));

  readonly ctrl = new ListController<OfferingRow>(this.rows);

  constructor() {
    this.api.load().subscribe();
  }

  goEnrollment(row: OfferingRow): void {
    this.router.navigate(['/enrollment'], { queryParams: { offeringId: row.id } });
  }

  goWorkspace(row: OfferingRow): void {
    this.router.navigate(['/courses', row.courseId, 'offerings', row.id]);
  }
}
