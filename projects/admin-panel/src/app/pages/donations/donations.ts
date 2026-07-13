import { Component, computed, inject, signal } from '@angular/core';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import {
  ApiDonation,
  ApiDonationStatus,
  ApiDonationType,
  DonationApiService,
  DonationPayload,
} from '../../core/services/donation-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { EventApiService } from '../../core/services/event-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { PdfService } from '../../core/services/pdf.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FilterTabs, FilterOption } from '../../shared/filter-tabs/filter-tabs';
import { StatCards, StatCardData } from '../../shared/stat-cards/stat-cards';
import { FieldDef } from '../../core/models/admin.models';

const NO_EVENT = '—';

interface DonationRow {
  id: string;
  donorName: string;
  donorLabel: string;
  isAnonymous: boolean;
  donorPhoneCountryCode: string;
  donorPhoneNumber: string;
  donorEmail: string;
  type: ApiDonationType;
  typeLabel: string;
  amountOrItem: string;
  branchId: string;
  branchName: string;
  eventId: string | null;
  eventTitle: string;
  proofImageUrl: string;
  statusKey: ApiDonationStatus;
  statusLabel: string;
  statusColor: string;
  certificateNo: string | null;
  certLabel: string;
  certColor: string;
  actionLabel: string;
  actionIcon: string;
  isVerify: boolean;
  isIssue: boolean;
  isResend: boolean;
}

const STATUS_COLOR: Record<ApiDonationStatus, string> = {
  pending: 'var(--w-muted)',
  received: 'var(--w-green)',
  verified: 'var(--w-accent)',
  rejected: 'var(--w-red)',
};

const STATUS_LABEL: Record<ApiDonationStatus, string> = {
  pending: 'Pending',
  received: 'Received',
  verified: 'Verified',
  rejected: 'Rejected',
};

function toRow(d: ApiDonation): DonationRow {
  const isVerify = d.status !== 'verified';
  const issued = !!d.certificateNo;
  const isIssue = !isVerify && !issued;
  return {
    id: d.id,
    donorName: d.donorName,
    donorLabel: d.isAnonymous ? 'Anonymous' : d.donorName,
    isAnonymous: d.isAnonymous,
    donorPhoneCountryCode: d.donorPhoneCountryCode ?? '',
    donorPhoneNumber: d.donorPhoneNumber,
    donorEmail: d.donorEmail,
    type: d.type,
    typeLabel: d.type === 'money' ? 'Money' : 'Goods',
    amountOrItem: d.type === 'money' ? `$${Number(d.amount).toFixed(2)}` : d.itemDescription ?? '',
    branchId: d.branchId,
    branchName: d.branchName,
    eventId: d.eventId,
    eventTitle: d.eventTitle ?? NO_EVENT,
    proofImageUrl: d.proofImageUrl ?? '',
    statusKey: d.status,
    statusLabel: STATUS_LABEL[d.status],
    statusColor: STATUS_COLOR[d.status],
    certificateNo: d.certificateNo,
    certLabel: issued ? '✓ Issued' : d.status === 'verified' ? 'Not issued' : '—',
    certColor: issued ? 'var(--w-green)' : 'var(--w-muted)',
    actionLabel: isVerify ? 'Verify' : isIssue ? 'Issue certificate' : 'Resend email',
    actionIcon: isVerify ? '✓' : isIssue ? '◈' : '✉',
    isVerify,
    isIssue,
    isResend: !isVerify && !isIssue,
  };
}

function buildFields(branchNames: string[], eventTitles: string[]): FieldDef[] {
  return [
    { key: 'donorName', label: 'Donor name', type: 'text' },
    { key: 'isAnonymous', label: 'Anonymous donor', type: 'select', options: ['No', 'Yes'] },
    { key: 'type', label: 'Type', type: 'select', options: ['Money', 'Goods'] },
    { key: 'amountOrItem', label: 'Amount / item', type: 'text' },
    { key: 'donorPhoneNumber', label: 'Donor phone', type: 'phone', countryKey: 'donorPhoneCountryCode' },
    { key: 'donorEmail', label: 'Donor email', type: 'email' },
    { key: 'branch', label: 'Branch', type: 'combobox', options: branchNames },
    { key: 'event', label: 'Related event', type: 'combobox', options: [NO_EVENT, ...eventTitles] },
    { key: 'proof', label: 'Proof photo', type: 'image' },
  ];
}

function toPayload(
  values: Record<string, string | number>,
  branchNameToId: Map<string, string>,
  eventTitleToId: Map<string, string>,
): DonationPayload {
  const branchId = branchNameToId.get(String(values['branch'] ?? '').trim().toLowerCase()) ?? '';
  const eventTitle = String(values['event'] ?? '').trim();
  const eventId = eventTitle && eventTitle !== NO_EVENT ? eventTitleToId.get(eventTitle.toLowerCase()) : undefined;

  const payload: DonationPayload = {
    donorName: String(values['donorName'] ?? '').trim(),
    isAnonymous: String(values['isAnonymous'] ?? 'No') === 'Yes',
    donorPhoneNumber: String(values['donorPhoneNumber'] ?? '').trim(),
    donorEmail: String(values['donorEmail'] ?? '').trim(),
    type: String(values['type'] ?? 'Money').toLowerCase() as ApiDonationType,
    amountOrItem: String(values['amountOrItem'] ?? '').trim(),
    branchId,
  };

  const phoneCountryCode = String(values['donorPhoneCountryCode'] ?? '').trim();
  if (phoneCountryCode) payload.donorPhoneCountryCode = phoneCountryCode;
  if (eventId) payload.eventId = eventId;

  return payload;
}

@Component({
  selector: 'app-donations',
  imports: [TableToolbar, FilterTabs, StatCards],
  templateUrl: './donations.html',
  styleUrl: './donations.scss',
})
export class Donations {
  private readonly api = inject(DonationApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly eventApi = inject(EventApiService);
  private readonly modal = inject(CrudModalService);
  private readonly uploads = inject(UploadApiService);
  private readonly pdf = inject(PdfService);
  private readonly toast = inject(ToastService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly filter = signal('all');
  readonly filterOptions: FilterOption[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'received', label: 'Received' },
    { key: 'verified', label: 'Verified' },
  ];

  private readonly branchNames = computed(() => this.branchApi.branches().map((b) => b.name));
  private readonly branchNameToId = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.name.toLowerCase(), b.id));
    return map;
  });

  private readonly eventTitles = computed(() => this.eventApi.events().map((e) => e.title));
  private readonly eventTitleToId = computed(() => {
    const map = new Map<string, string>();
    this.eventApi.events().forEach((e) => map.set(e.title.toLowerCase(), e.id));
    return map;
  });

  private readonly rows = computed<DonationRow[]>(() => this.api.donations().map(toRow));

  private readonly filteredRows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.rows() : this.rows().filter((d) => d.statusKey === f);
  });

  readonly ctrl = new ListController<DonationRow>(this.filteredRows);

  readonly stats = computed<StatCardData[]>(() => {
    const rows = this.api.donations();
    const now = new Date();
    const totalThisMonth = rows
      .filter((d) => d.type === 'money' && d.amount)
      .filter((d) => {
        const created = new Date(d.createdAt);
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
      })
      .reduce((sum, d) => sum + Number(d.amount), 0);

    return [
      { label: 'Total this month', value: `$${totalThisMonth.toFixed(2)}` },
      { label: 'Pending review', value: rows.filter((d) => d.status === 'pending').length },
      { label: 'Certificates issued', value: rows.filter((d) => !!d.certificateNo).length },
      { label: 'Anonymous donors', value: rows.filter((d) => d.isAnonymous).length },
    ];
  });

  constructor() {
    this.api.load().subscribe();
    this.branchApi.load().subscribe();
    this.eventApi.load().subscribe();
  }

  setFilter = (key: string) => this.filter.set(key);

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private resolvePayload(values: Record<string, string | number>): Observable<DonationPayload> {
    const payload = toPayload(values, this.branchNameToId(), this.eventTitleToId());
    const proof = String(values['proof'] ?? '');
    if (proof.startsWith('data:')) {
      return this.uploads.uploadDataUri(proof).pipe(map((url) => ({ ...payload, proofImage: url })));
    }
    if (proof) payload.proofImage = proof;
    return of(payload);
  }

  action(row: DonationRow): void {
    if (row.isVerify) {
      this.api.verify(row.id).subscribe({
        next: () => this.toast.show(`Donation from ${row.donorLabel} verified.`, 'success'),
        error: (err) => this.showError(err, 'Failed to verify donation.'),
      });
      return;
    }

    this.api.issueCertificate(row.id).subscribe({
      next: (res) => {
        this.pdf.downloadCertificate({
          kind: 'Certificate of Appreciation',
          recipientName: row.donorLabel,
          bodyLine: `In grateful acknowledgement of your generous donation of ${row.amountOrItem} toward ${row.eventTitle === NO_EVENT ? 'the institute' : row.eventTitle}.`,
          refNo: res.certificateNo ?? row.certificateNo ?? '',
          issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        });
        this.toast.show(
          row.isResend
            ? `Anumodana certificate re-sent to ${row.donorLabel} by email (simulated) — PDF downloaded.`
            : `Anumodana certificate issued to ${row.donorLabel} and emailed (simulated) — PDF downloaded.`,
          'success',
        );
        this.api.load().subscribe();
      },
      error: (err) => this.showError(err, 'Failed to issue certificate.'),
    });
  }

  addDonation(): void {
    this.modal.open({
      title: 'Log Donation',
      fields: buildFields(this.branchNames(), this.eventTitles()),
      isEdit: false,
      values: {
        donorName: '',
        isAnonymous: 'No',
        type: 'Money',
        amountOrItem: '',
        donorPhoneCountryCode: '',
        donorPhoneNumber: '',
        donorEmail: '',
        branch: '',
        event: NO_EVENT,
        proof: '',
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.create(payload)),
          tap({ error: (err) => this.showError(err, 'Failed to log donation.') }),
        ),
    });
  }

  editDonation(row: DonationRow): void {
    this.modal.open({
      title: 'Edit Donation',
      fields: buildFields(this.branchNames(), this.eventTitles()),
      isEdit: true,
      values: {
        donorName: row.donorName,
        isAnonymous: row.isAnonymous ? 'Yes' : 'No',
        type: row.typeLabel,
        amountOrItem: row.type === 'money' ? row.amountOrItem.replace('$', '') : row.amountOrItem,
        donorPhoneCountryCode: row.donorPhoneCountryCode,
        donorPhoneNumber: row.donorPhoneNumber,
        donorEmail: row.donorEmail,
        branch: row.branchName === '—' ? '' : row.branchName,
        event: row.eventTitle,
        proof: row.proofImageUrl,
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.update(row.id, payload)),
          tap({ error: (err) => this.showError(err, 'Failed to update donation.') }),
        ),
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete donation.') })),
    });
  }
}
