import { Component, computed, inject } from '@angular/core';
import { map, Observable, of, switchMap, tap } from 'rxjs';
import { COUNTRIES } from '../../core/data/countries';
import { ApiBranch, BranchApiService, BranchPayload } from '../../core/services/branch-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { ImageViewerService } from '../../core/services/image-viewer.service';
import { ToastService } from '../../core/services/toast.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { FieldDef } from '../../core/models/admin.models';

interface BranchRow {
  key: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  address: string;
  zipCode: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  logoUrl: string;
  adminCount: number;
  userCount: number;
  eventCount: number;
  active: boolean;
  statusLabel: string;
  statusColor: string;
  toggleLabel: string;
  toggleColor: string;
}

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name).sort((a, b) => a.localeCompare(b));

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Branch name', type: 'text' },
  { key: 'country', label: 'Country', type: 'combobox', options: COUNTRY_NAMES },
  { key: 'city', label: 'City', type: 'combobox', dependsOn: 'country' },
  { key: 'timezone', label: 'Timezone', type: 'timezone' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'zipCode', label: 'Zip / Postal code', type: 'text' },
  { key: 'phoneNumber', label: 'Phone Number', type: 'phone', countryKey: 'phoneCountryCode' },
  { key: 'email', label: 'Branch email', type: 'email' },
  { key: 'logo', label: 'Branch photo', type: 'image' },
];

function toRow(b: ApiBranch): BranchRow {
  const active = b.status === 'active';
  return {
    key: b.id,
    name: b.name,
    city: b.city ?? '',
    country: b.country,
    timezone: b.timezone,
    address: b.address ?? '',
    zipCode: b.zipCode ?? '',
    phoneCountryCode: b.phoneCountryCode ?? '',
    phoneNumber: b.phoneNumber ?? '',
    email: b.email ?? '',
    logoUrl: b.logoUrl ?? '',
    adminCount: b.adminCount,
    userCount: b.userCount,
    eventCount: b.eventCount,
    active,
    statusLabel: active ? 'Active' : 'Inactive',
    statusColor: active ? 'var(--w-green)' : 'var(--w-muted)',
    toggleLabel: active ? 'Deactivate' : 'Activate',
    toggleColor: active ? 'var(--w-red)' : 'var(--w-green)',
  };
}

const OPTIONAL_TEXT_KEYS = [
  'city',
  'country',
  'timezone',
  'address',
  'zipCode',
  'phoneCountryCode',
  'phoneNumber',
  'email',
  'logo',
] as const;

function toPayload(values: Record<string, string | number>): BranchPayload {
  const payload: BranchPayload = { name: String(values['name'] ?? '').trim() };
  for (const key of OPTIONAL_TEXT_KEYS) {
    const value = String(values[key] ?? '').trim();
    if (value) payload[key] = value;
  }
  return payload;
}

@Component({
  selector: 'app-branches',
  imports: [TableToolbar],
  templateUrl: './branches.html',
  styleUrl: './branches.scss',
})
export class Branches {
  private readonly api = inject(BranchApiService);
  private readonly modal = inject(CrudModalService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);
  private readonly imageViewer = inject(ImageViewerService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  private readonly rows = computed<BranchRow[]>(() => this.api.branches().map(toRow));

  readonly ctrl = new ListController<BranchRow>(this.rows, 'card');

  constructor() {
    this.api.load().subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  viewLogo(row: BranchRow): void {
    if (row.logoUrl) this.imageViewer.open(row.logoUrl);
  }

  toggleStatus(row: BranchRow): void {
    const nextStatus = row.active ? 'inactive' : 'active';
    this.api.update(row.key, { status: nextStatus }).subscribe({
      next: () => this.toast.show(`${row.name} is now ${nextStatus}.`, 'success'),
      error: (err) => this.showError(err, 'Failed to update branch status.'),
    });
  }

  private resolvePayload(values: Record<string, string | number>): Observable<BranchPayload> {
    const payload = toPayload(values);
    if (payload.logo?.startsWith('data:')) {
      return this.uploads.uploadDataUri(payload.logo).pipe(map((url) => ({ ...payload, logo: url })));
    }
    return of(payload);
  }

  addBranch(): void {
    this.modal.open({
      title: 'Add Branch',
      fields: FIELDS,
      isEdit: false,
      values: {
        name: '',
        city: '',
        country: '',
        timezone: '',
        address: '',
        zipCode: '',
        phoneCountryCode: '',
        phoneNumber: '',
        email: '',
        logo: '',
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.create(payload)),
          tap({ error: (err) => this.showError(err, 'Failed to create branch.') }),
        ),
    });
  }

  editBranch(row: BranchRow): void {
    this.modal.open({
      title: 'Edit Branch',
      fields: FIELDS,
      isEdit: true,
      values: {
        name: row.name,
        city: row.city,
        country: row.country,
        timezone: row.timezone,
        address: row.address,
        zipCode: row.zipCode,
        phoneCountryCode: row.phoneCountryCode,
        phoneNumber: row.phoneNumber,
        email: row.email,
        logo: row.logoUrl,
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.update(row.key, payload)),
          tap({ error: (err) => this.showError(err, 'Failed to update branch.') }),
        ),
      onDelete: () =>
        this.api.remove(row.key).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete branch.') })),
    });
  }
}
