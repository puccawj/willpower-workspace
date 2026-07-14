import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, tap, throwError } from 'rxjs';
import { ApiEvent, EventApiService } from '../../../core/services/event-api.service';
import { ApiEventNeed, ApiEventNeedType, EventNeedApiService } from '../../../core/services/event-need-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateFull } from '../../../core/date-time.util';

interface NeedRow {
  id: string;
  title: string;
  type: ApiEventNeedType;
  unit: string | null;
  target: number;
  received: number;
  pct: number;
  progressLabel: string;
}

function toRow(n: ApiEventNeed): NeedRow {
  const target = Number(n.targetQuantity);
  const received = Number(n.receivedQuantity);
  const pct = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : 0;
  const unitLabel = n.type === 'money' ? 'USD' : (n.unit ?? '');
  return {
    id: n.id,
    title: n.title,
    type: n.type,
    unit: n.unit,
    target,
    received,
    pct,
    progressLabel: `${received.toLocaleString()} / ${target.toLocaleString()} ${unitLabel}`.trim(),
  };
}

@Component({
  selector: 'app-event-needs',
  imports: [],
  templateUrl: './event-needs.html',
  styleUrl: './event-needs.scss',
})
export class EventNeeds {
  private readonly eventApi = inject(EventApiService);
  private readonly needApi = inject(EventNeedApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = this.needApi.loading;
  readonly error = this.needApi.error;

  private readonly eventId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  readonly event = signal<ApiEvent | null>(null);
  readonly dateFull = computed(() => (this.event() ? formatDateFull(new Date(this.event()!.startAt)) : ''));
  readonly rows = computed<NeedRow[]>(() => this.needApi.needs().map(toRow));

  constructor() {
    const id = this.eventId();
    if (id) {
      this.eventApi.getOne(id).subscribe({
        next: (ev) => this.event.set(ev),
        error: (err) => this.showError(err, 'Failed to load event.'),
      });
      this.needApi.load(id).subscribe();
    }
  }

  goEvents(): void {
    this.router.navigate(['/events']);
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  addNeed(): void {
    const eventId = this.eventId();
    this.modal.open({
      title: 'Add Need',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: ['Goods', 'Money'] },
        { key: 'unit', label: 'Unit (e.g. bags, pieces) — goods only', type: 'text' },
        { key: 'targetQuantity', label: 'Target quantity', type: 'number', min: 0 },
      ],
      isEdit: false,
      values: { title: '', type: 'Goods', unit: '', targetQuantity: 1 },
      onSave: (values) => {
        const type: ApiEventNeedType = String(values['type']).toLowerCase() === 'money' ? 'money' : 'goods';
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const targetQuantity = Number(values['targetQuantity']);
        if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
          this.toast.show('Please enter a target quantity greater than 0.', 'error');
          return throwError(() => new Error('invalid-target-quantity'));
        }
        return this.needApi
          .create(eventId, {
            title,
            type,
            unit: type === 'goods' ? String(values['unit'] ?? '').trim() || undefined : undefined,
            targetQuantity,
          })
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to add need.') }));
      },
    });
  }

  editNeed(row: NeedRow): void {
    const eventId = this.eventId();
    this.modal.open({
      title: 'Edit Need',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: ['Goods', 'Money'] },
        { key: 'unit', label: 'Unit (e.g. bags, pieces) — goods only', type: 'text' },
        { key: 'targetQuantity', label: 'Target quantity', type: 'number', min: 0 },
      ],
      isEdit: true,
      values: {
        title: row.title,
        type: row.type === 'money' ? 'Money' : 'Goods',
        unit: row.unit ?? '',
        targetQuantity: row.target,
      },
      onSave: (values) => {
        const type: ApiEventNeedType = String(values['type']).toLowerCase() === 'money' ? 'money' : 'goods';
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const targetQuantity = Number(values['targetQuantity']);
        if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
          this.toast.show('Please enter a target quantity greater than 0.', 'error');
          return throwError(() => new Error('invalid-target-quantity'));
        }
        return this.needApi
          .update(eventId, row.id, {
            title,
            type,
            unit: type === 'goods' ? String(values['unit'] ?? '').trim() || undefined : undefined,
            targetQuantity,
          })
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to update need.') }));
      },
      onDelete: () =>
        this.needApi.remove(eventId, row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete need.') })),
    });
  }
}
