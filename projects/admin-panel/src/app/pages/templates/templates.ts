import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map, of, switchMap, tap, Observable } from 'rxjs';
import {
  ApiCertificateTemplate,
  ApiTemplateType,
  CertificateTemplateApiService,
  TemplatePayload,
} from '../../core/services/certificate-template-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { ImageViewerService } from '../../core/services/image-viewer.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FieldDef } from '../../core/models/admin.models';
import { CertLayoutFieldKey, CertLayoutPosition, DEFAULT_CERT_POSITIONS } from '../../core/services/pdf.service';

const GLOBAL_BRANCH = 'Global (all branches)';

interface TemplateRow {
  id: string;
  name: string;
  typeLabel: string;
  type: ApiTemplateType;
  year: string;
  branchId: string | null;
  branchName: string;
  backgroundImageUrl: string;
  isActive: boolean;
  statusLabel: string;
  statusColor: string;
}

const TYPE_OPTIONS = ['Certificate', 'Donation (Money)', 'Donation (Goods)'];
const TYPE_TO_API: Record<string, ApiTemplateType> = {
  Certificate: 'certificate',
  'Donation (Money)': 'donation_money',
  'Donation (Goods)': 'donation_goods',
};
const TYPE_LABEL: Record<ApiTemplateType, string> = {
  certificate: 'Certificate',
  donation_money: 'Donation (Money)',
  donation_goods: 'Donation (Goods)',
};

const SAMPLE_LABELS: Record<Exclude<CertLayoutFieldKey, 'kicker'>, string> = {
  name: 'Jane Q. Student',
  course: 'The Path of Willpower',
  certNo: 'No. WPI-CERT-2026-0512',
  issueDate: 'Issued Jul 20, 2026',
};

const PALETTE_LABELS: Record<CertLayoutFieldKey, string> = {
  kicker: 'Header',
  name: 'Recipient name',
  course: 'Course / body line',
  certNo: 'Certificate no.',
  issueDate: 'Issue date',
};

const ALL_FIELD_KEYS: CertLayoutFieldKey[] = ['kicker', 'name', 'course', 'certNo', 'issueDate'];

function toRow(t: ApiCertificateTemplate): TemplateRow {
  return {
    id: t.id,
    name: t.name,
    typeLabel: TYPE_LABEL[t.type],
    type: t.type,
    year: t.year ? String(t.year) : '—',
    branchId: t.branchId,
    branchName: t.branchName ?? GLOBAL_BRANCH,
    backgroundImageUrl: t.backgroundImageUrl,
    isActive: t.isActive,
    statusLabel: t.isActive ? 'Active' : 'Inactive',
    statusColor: t.isActive ? 'var(--w-green)' : 'var(--w-muted)',
  };
}

@Component({
  selector: 'app-templates',
  imports: [TableToolbar, FormsModule],
  templateUrl: './templates.html',
  styleUrl: './templates.scss',
})
export class Templates {
  private readonly api = inject(CertificateTemplateApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly modal = inject(CrudModalService);
  private readonly uploads = inject(UploadApiService);
  private readonly imageViewer = inject(ImageViewerService);
  private readonly toast = inject(ToastService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  private readonly branchNames = computed(() => this.branchApi.branches().map((b) => b.name));
  private readonly branchNameToId = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.name.toLowerCase(), b.id));
    return map;
  });

  private readonly rows = computed<TemplateRow[]>(() => this.api.templates().map(toRow));

  readonly ctrl = new ListController<TemplateRow>(this.rows);

  // ---- Layout designer ----

  readonly selectedTemplateId = signal('');
  readonly selectedTemplate = computed<TemplateRow | null>(
    () => this.rows().find((r) => r.id === this.selectedTemplateId()) ?? null,
  );

  /** Only fields the admin has actually placed on the canvas — anything else stays in the outside palette. */
  readonly positions = signal<Partial<Record<CertLayoutFieldKey, CertLayoutPosition>>>({});
  readonly kickerText = signal('CERTIFICATE OF COMPLETION');

  readonly placedFields = computed(() => ALL_FIELD_KEYS.filter((k) => this.positions()[k]));
  readonly paletteFields = computed(() => ALL_FIELD_KEYS.filter((k) => !this.positions()[k]));

  private readonly canvasRef = viewChild<ElementRef<HTMLDivElement>>('designerCanvas');
  private draggingKey: CertLayoutFieldKey | null = null;
  private dirty = false;

  constructor() {
    this.api.load().subscribe(() => {
      if (!this.selectedTemplateId() && this.rows().length) this.selectForDesign(this.rows()[0]);
    });
    this.branchApi.load().subscribe();
  }

  fieldLabel(key: CertLayoutFieldKey): string {
    return key === 'kicker' ? this.kickerText() : SAMPLE_LABELS[key];
  }

  paletteLabel(key: CertLayoutFieldKey): string {
    return PALETTE_LABELS[key];
  }

  private buildFields(): FieldDef[] {
    return [
      { key: 'name', label: 'Template name', type: 'text' },
      { key: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'branch', label: 'Branch', type: 'combobox', options: [GLOBAL_BRANCH, ...this.branchNames()] },
      { key: 'background', label: 'Background image', type: 'image' },
    ];
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  viewBackground(row: TemplateRow): void {
    if (row.backgroundImageUrl) this.imageViewer.open(row.backgroundImageUrl);
  }

  selectForDesign(row: TemplateRow): void {
    this.selectedTemplateId.set(row.id);
    const raw = this.api.templates().find((t) => t.id === row.id);
    this.positions.set({ ...(raw?.layoutConfig?.positions ?? {}) });
    this.kickerText.set(raw?.layoutConfig?.kickerText || 'CERTIFICATE OF COMPLETION');
  }

  /** Moves a field from the outside palette onto the canvas at a sensible starting position. */
  addFieldToCanvas(key: CertLayoutFieldKey): void {
    this.positions.update((current) => ({ ...current, [key]: { ...DEFAULT_CERT_POSITIONS[key] } }));
    this.dirty = true;
    this.saveLayout();
  }

  /** Removes a field from the canvas, sending it back to the outside palette. */
  removeField(key: CertLayoutFieldKey, event: Event): void {
    event.stopPropagation();
    this.positions.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    this.dirty = true;
    this.saveLayout();
  }

  onKickerTextChange(value: string): void {
    this.kickerText.set(value);
    this.dirty = true;
    this.saveLayout();
  }

  startDrag(key: CertLayoutFieldKey, event: PointerEvent): void {
    event.preventDefault();
    this.draggingKey = key;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.draggingKey) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const xPct = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100));

    this.positions.update((current) => ({ ...current, [this.draggingKey as CertLayoutFieldKey]: { xPct, yPct } }));
    this.dirty = true;
  }

  endDrag(): void {
    if (this.draggingKey && this.dirty) this.saveLayout();
    this.draggingKey = null;
  }

  private saveLayout(): void {
    const id = this.selectedTemplateId();
    if (!id) return;
    this.dirty = false;
    this.api
      .saveLayout(id, { kickerText: this.kickerText(), positions: this.positions() })
      .subscribe({ error: (err) => this.showError(err, 'Failed to save layout.') });
  }

  private toPayload(values: Record<string, string | number>): TemplatePayload {
    const branchName = String(values['branch'] ?? '').trim();
    const branchId = branchName && branchName !== GLOBAL_BRANCH ? this.branchNameToId().get(branchName.toLowerCase()) : undefined;

    const payload: TemplatePayload = {
      name: String(values['name'] ?? '').trim(),
      type: TYPE_TO_API[String(values['type'] ?? 'Certificate')] ?? 'certificate',
      backgroundImage: '',
    };
    if (branchId) payload.branchId = branchId;
    const year = Number(values['year']);
    if (year > 0) payload.year = year;

    return payload;
  }

  private resolvePayload(values: Record<string, string | number>): Observable<TemplatePayload> {
    const payload = this.toPayload(values);
    const background = String(values['background'] ?? '');
    if (background.startsWith('data:')) {
      return this.uploads.uploadDataUri(background).pipe(map((url) => ({ ...payload, backgroundImage: url })));
    }
    payload.backgroundImage = background;
    return of(payload);
  }

  toggleActive(row: TemplateRow): void {
    this.api.update(row.id, { isActive: !row.isActive }).subscribe({
      next: () =>
        this.toast.show(
          row.isActive ? `"${row.name}" archived.` : `"${row.name}" set as the active ${row.typeLabel.toLowerCase()} template.`,
          'success',
        ),
      error: (err) => this.showError(err, 'Failed to update template status.'),
    });
  }

  addTemplate(): void {
    this.modal.open({
      title: 'Add Certificate Template',
      fields: this.buildFields(),
      isEdit: false,
      values: { name: '', type: 'Certificate', year: new Date().getFullYear(), branch: GLOBAL_BRANCH, background: '' },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.create(payload)),
          tap({
            next: () => {
              const created = this.api.templates().find((t) => t.name === String(values['name']));
              if (created) this.selectForDesign(toRow(created));
            },
            error: (err) => this.showError(err, 'Failed to create template.'),
          }),
        ),
    });
  }

  editTemplate(row: TemplateRow): void {
    this.modal.open({
      title: 'Edit Certificate Template',
      fields: this.buildFields(),
      isEdit: true,
      values: {
        name: row.name,
        type: row.typeLabel,
        year: row.year === '—' ? new Date().getFullYear() : Number(row.year),
        branch: row.branchName,
        background: row.backgroundImageUrl,
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.update(row.id, payload)),
          tap({ error: (err) => this.showError(err, 'Failed to update template.') }),
        ),
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete template.') })),
    });
  }
}
