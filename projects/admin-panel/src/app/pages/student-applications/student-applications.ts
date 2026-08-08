import { Component, computed, inject, signal } from '@angular/core';
import { FilterTabs, FilterOption } from '../../shared/filter-tabs/filter-tabs';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { ListController } from '../../core/list-controller';
import {
  ApiStudentApplication,
  StudentApplicationApiService,
} from '../../core/services/student-application-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { formatDateFull } from '../../core/date-time.util';

type FilterKey = 'pending' | 'approved' | 'rejected' | 'all';

interface StudentApplicationRow {
  id: string;
  fullName: string;
  nickname: string;
  email: string;
  phone: string;
  lineId: string;
  photoUrl: string | null;
  contactLabel: string;
  appliedLabel: string;
  status: 'pending' | 'approved' | 'rejected';
  statusLabel: string;
  statusColor: string;
}

const STATUS_LABEL: Record<StudentApplicationRow['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_COLOR: Record<StudentApplicationRow['status'], string> = {
  pending: 'var(--w-muted)',
  approved: 'var(--w-green)',
  rejected: 'var(--w-red)',
};

function toRow(a: ApiStudentApplication): StudentApplicationRow {
  return {
    id: a.id,
    fullName: `${a.firstName} ${a.lastName}`,
    nickname: a.nickname,
    email: a.email,
    phone: a.phone ?? '',
    lineId: a.lineId ?? '',
    photoUrl: a.photoUrl,
    contactLabel: [a.phone, a.lineId ? `LINE: ${a.lineId}` : ''].filter(Boolean).join(' · ') || '—',
    appliedLabel: formatDateFull(new Date(a.createdAt)),
    status: a.status,
    statusLabel: STATUS_LABEL[a.status],
    statusColor: STATUS_COLOR[a.status],
  };
}

@Component({
  selector: 'app-student-applications',
  imports: [FilterTabs, TableToolbar],
  templateUrl: './student-applications.html',
  styleUrl: './student-applications.scss',
})
export class StudentApplications {
  private readonly api = inject(StudentApplicationApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly filterOptions: FilterOption[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  readonly filter = signal<FilterKey>('pending');

  private readonly rows = computed<StudentApplicationRow[]>(() => this.api.applications().map(toRow));

  readonly ctrl = new ListController<StudentApplicationRow>(this.rows);

  constructor() {
    this.reload();
  }

  setFilter = (key: string): void => {
    this.filter.set(key as FilterKey);
    this.reload();
  };

  private reload(): void {
    this.api.load(this.filter()).subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  async approve(row: StudentApplicationRow): Promise<void> {
    const confirmed = await this.confirm.ask(
      `Approve ${row.fullName} ("${row.nickname}")? Their account role will change to student.`,
      { title: 'Approve application', confirmLabel: 'Approve' },
    );
    if (!confirmed) return;

    this.api.approve(row.id).subscribe({
      next: () => {
        this.toast.show(`${row.nickname} is now a student.`, 'success');
        this.reload();
      },
      error: (err) => this.showError(err, 'Failed to approve application.'),
    });
  }

  async reject(row: StudentApplicationRow): Promise<void> {
    const confirmed = await this.confirm.ask(`Reject the application from ${row.fullName}?`, {
      title: 'Reject application',
      confirmLabel: 'Reject',
      danger: true,
    });
    if (!confirmed) return;

    this.api.reject(row.id).subscribe({
      next: () => {
        this.toast.show('Application rejected.', 'success');
        this.reload();
      },
      error: (err) => this.showError(err, 'Failed to reject application.'),
    });
  }
}
