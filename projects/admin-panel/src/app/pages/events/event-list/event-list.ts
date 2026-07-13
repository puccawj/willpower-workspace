import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, of, switchMap, tap } from 'rxjs';
import { BranchApiService } from '../../../core/services/branch-api.service';
import { ApiEventStatus, EventApiService, EventPayload } from '../../../core/services/event-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ImageViewerService } from '../../../core/services/image-viewer.service';
import { ToastService } from '../../../core/services/toast.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { ListController } from '../../../core/list-controller';
import { formatDateFull, toDateTimeLocalValue } from '../../../core/date-time.util';
import { TableToolbar } from '../../../shared/table-toolbar/table-toolbar';
import { FilterTabs, FilterOption } from '../../../shared/filter-tabs/filter-tabs';
import { FieldDef } from '../../../core/models/admin.models';

interface EventRow {
  id: string;
  title: string;
  branchName: string;
  location: string;
  description: string;
  dateFull: string;
  startAtLocal: string;
  endAtLocal: string;
  capacity: number;
  going: number;
  maybe: number;
  cancel: number;
  waitlist: number;
  statusKey: ApiEventStatus;
  status: string;
  coverImageUrl: string;
}

const STATUS_OPTIONS = ['Draft', 'Publish', 'Closed'];
const STATUS_TO_API: Record<string, ApiEventStatus> = {
  Draft: 'draft',
  Publish: 'published',
  Closed: 'closed',
};
const STATUS_LABEL: Record<ApiEventStatus, string> = {
  draft: 'Draft',
  published: 'Publish',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  Draft: 'var(--w-muted)',
  Publish: 'var(--w-accent)',
  Closed: 'var(--w-ink-soft)',
};

function buildFields(branchNames: string[]): FieldDef[] {
  return [
    { key: 'title', label: 'Event title', type: 'text' },
    { key: 'branch', label: 'Branch', type: 'combobox', options: branchNames },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'startAt', label: 'Start', type: 'datetime' },
    { key: 'endAt', label: 'End', type: 'datetime' },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'cover', label: 'Cover image', type: 'image' },
  ];
}

function toPayload(values: Record<string, string | number>, branchNameToId: Map<string, string>): EventPayload {
  const branchId = branchNameToId.get(String(values['branch'] ?? '').trim().toLowerCase()) ?? '';
  const payload: EventPayload = {
    title: String(values['title'] ?? '').trim(),
    branchId,
    startAt: new Date(String(values['startAt'])).toISOString(),
    endAt: new Date(String(values['endAt'])).toISOString(),
    status: STATUS_TO_API[String(values['status'] ?? '')] ?? 'draft',
  };

  const location = String(values['location'] ?? '').trim();
  const description = String(values['description'] ?? '').trim();
  if (location) payload.location = location;
  if (description) payload.description = description;

  const capacity = Number(values['capacity']);
  if (capacity > 0) payload.capacity = capacity;

  return payload;
}

@Component({
  selector: 'app-event-list',
  imports: [TableToolbar, FilterTabs],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  private readonly api = inject(EventApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly modal = inject(CrudModalService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly imageViewer = inject(ImageViewerService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;
  readonly statusColors = STATUS_COLORS;

  readonly filter = signal('all');
  readonly filterOptions: FilterOption[] = [
    { key: 'all', label: 'All' },
    { key: 'Publish', label: 'Publish' },
    { key: 'Draft', label: 'Draft' },
    { key: 'Closed', label: 'Closed' },
  ];

  private readonly branchNameById = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.id, b.name));
    return map;
  });

  private readonly branchNameToId = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.name.toLowerCase(), b.id));
    return map;
  });

  private readonly branchNames = computed(() => this.branchApi.branches().map((b) => b.name));

  private readonly rows = computed<EventRow[]>(() => {
    const branchNameById = this.branchNameById();
    return this.api.events().map((ev) => ({
      id: ev.id,
      title: ev.title,
      branchName: branchNameById.get(ev.branchId) ?? '—',
      location: ev.location ?? '',
      description: ev.description ?? '',
      dateFull: formatDateFull(new Date(ev.startAt)),
      startAtLocal: toDateTimeLocalValue(new Date(ev.startAt)),
      endAtLocal: toDateTimeLocalValue(new Date(ev.endAt)),
      capacity: ev.capacity ?? 0,
      going: ev.going,
      maybe: ev.maybe,
      cancel: ev.cancel,
      waitlist: ev.waitlist,
      statusKey: ev.status,
      status: STATUS_LABEL[ev.status],
      coverImageUrl: ev.coverImageUrl ?? '',
    }));
  });

  private readonly filteredRows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.rows() : this.rows().filter((ev) => ev.status === f);
  });

  readonly ctrl = new ListController<EventRow>(this.filteredRows);

  constructor() {
    this.api.load().subscribe();
    this.branchApi.load().subscribe();
  }

  setFilter = (key: string) => this.filter.set(key);

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  rsvpSummary(ev: EventRow): string {
    return `${ev.going}✓ ${ev.maybe}? ${ev.cancel}✕`;
  }

  openRsvp(ev: EventRow): void {
    this.router.navigate(['/rsvp', ev.id]);
  }

  viewCover(ev: EventRow): void {
    if (ev.coverImageUrl) this.imageViewer.open(ev.coverImageUrl);
  }

  private resolvePayload(values: Record<string, string | number>): Observable<EventPayload> {
    const payload = toPayload(values, this.branchNameToId());
    const cover = String(values['cover'] ?? '');
    if (cover.startsWith('data:')) {
      return this.uploads.uploadDataUri(cover).pipe(map((url) => ({ ...payload, coverImage: url })));
    }
    if (cover) payload.coverImage = cover;
    return of(payload);
  }

  addEvent(): void {
    const start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    this.modal.open({
      title: 'Add Event',
      fields: buildFields(this.branchNames()),
      isEdit: false,
      values: {
        title: '',
        branch: '',
        location: '',
        description: '',
        startAt: toDateTimeLocalValue(start),
        endAt: toDateTimeLocalValue(end),
        capacity: 20,
        status: 'Draft',
        cover: '',
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.create(payload)),
          tap({ error: (err) => this.showError(err, 'Failed to create event.') }),
        ),
    });
  }

  editEvent(row: EventRow): void {
    this.modal.open({
      title: 'Edit Event',
      fields: buildFields(this.branchNames()),
      isEdit: true,
      values: {
        title: row.title,
        branch: row.branchName === '—' ? '' : row.branchName,
        location: row.location,
        description: row.description,
        startAt: row.startAtLocal,
        endAt: row.endAtLocal,
        capacity: row.capacity,
        status: row.status,
        cover: row.coverImageUrl,
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.update(row.id, payload)),
          tap({ error: (err) => this.showError(err, 'Failed to update event.') }),
        ),
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete event.') })),
    });
  }
}
