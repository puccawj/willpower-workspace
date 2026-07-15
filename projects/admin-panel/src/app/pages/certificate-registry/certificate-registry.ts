import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApiRegistryRow,
  CertificateRegistryApiService,
  RegistryStatus,
  RegistryType,
} from '../../core/services/certificate-registry-api.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FilterTabs, FilterOption } from '../../shared/filter-tabs/filter-tabs';
import { StatCards, StatCardData } from '../../shared/stat-cards/stat-cards';

interface RegistryRowView {
  certificateNo: string;
  recipientName: string;
  recipientEmail: string;
  type: RegistryType;
  typeLabel: string;
  detail: string;
  issuedAtLabel: string;
  issuedByName: string;
  status: RegistryStatus;
  statusLabel: string;
  statusColor: string;
}

function toView(r: ApiRegistryRow): RegistryRowView {
  return {
    certificateNo: r.certificateNo,
    recipientName: r.recipientName,
    recipientEmail: r.recipientEmail,
    type: r.type,
    typeLabel: r.type === 'course' ? 'Course' : 'Donation',
    detail: r.detail,
    issuedAtLabel: new Date(r.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    issuedByName: r.issuedByName ?? '—',
    status: r.status,
    statusLabel: r.status === 'issued' ? 'Issued' : 'Voided',
    statusColor: r.status === 'issued' ? 'var(--w-green)' : 'var(--w-muted)',
  };
}

@Component({
  selector: 'app-certificate-registry',
  imports: [TableToolbar, FilterTabs, StatCards, FormsModule],
  templateUrl: './certificate-registry.html',
  styleUrl: './certificate-registry.scss',
})
export class CertificateRegistry {
  private readonly api = inject(CertificateRegistryApiService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly statusFilter = signal('all');
  readonly statusFilterOptions: FilterOption[] = [
    { key: 'all', label: 'All' },
    { key: 'issued', label: 'Issued' },
    { key: 'voided', label: 'Voided' },
  ];

  readonly typeFilter = signal('all');

  private readonly rows = computed<RegistryRowView[]>(() => this.api.rows().map(toView));

  private readonly filteredRows = computed(() => {
    const status = this.statusFilter();
    const type = this.typeFilter();
    return this.rows().filter(
      (r) => (status === 'all' || r.status === status) && (type === 'all' || r.type === type),
    );
  });

  readonly ctrl = new ListController<RegistryRowView>(this.filteredRows);

  readonly stats = computed<StatCardData[]>(() => {
    const rows = this.api.rows();
    const latestNo = (type: RegistryType) => rows.find((r) => r.type === type)?.certificateNo ?? '—';
    const issuedCount = rows.filter((r) => r.status === 'issued').length;
    const voidedCount = rows.filter((r) => r.status === 'voided').length;

    return [
      { label: 'Latest course cert #', value: latestNo('course') },
      { label: 'Latest donation cert #', value: latestNo('donation') },
      { label: 'Currently issued', value: issuedCount },
      { label: 'Voided', value: voidedCount },
    ];
  });

  constructor() {
    this.api.load().subscribe();
  }

  setStatusFilter = (key: string) => this.statusFilter.set(key);

  setTypeFilter(value: string): void {
    this.typeFilter.set(value);
  }
}
