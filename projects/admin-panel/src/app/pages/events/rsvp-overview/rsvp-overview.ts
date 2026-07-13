import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BranchApiService } from '../../../core/services/branch-api.service';
import { ApiEvent, EventApiService } from '../../../core/services/event-api.service';
import { ListController } from '../../../core/list-controller';
import { formatDateFull } from '../../../core/date-time.util';
import { StatCards, StatCardData } from '../../../shared/stat-cards/stat-cards';
import { FilterTabs, FilterOption } from '../../../shared/filter-tabs/filter-tabs';
import { TableToolbar } from '../../../shared/table-toolbar/table-toolbar';

interface EventOverviewRow {
  id: string;
  title: string;
  branchName: string;
  dateFull: string;
  going: number;
  maybe: number;
  cancel: number;
  waitlist: number;
}

interface BranchTotalsRow {
  branchId: string;
  branchName: string;
  going: number;
  maybe: number;
  cancel: number;
  waitlist: number;
}

type ViewMode = 'combined' | 'byBranch';

function sumCounts(events: ApiEvent[]): { going: number; maybe: number; cancel: number; waitlist: number } {
  return events.reduce(
    (acc, e) => ({
      going: acc.going + e.going,
      maybe: acc.maybe + e.maybe,
      cancel: acc.cancel + e.cancel,
      waitlist: acc.waitlist + e.waitlist,
    }),
    { going: 0, maybe: 0, cancel: 0, waitlist: 0 },
  );
}

@Component({
  selector: 'app-rsvp-overview',
  imports: [StatCards, FilterTabs, TableToolbar],
  templateUrl: './rsvp-overview.html',
  styleUrl: './rsvp-overview.scss',
})
export class RsvpOverview {
  private readonly eventApi = inject(EventApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly router = inject(Router);

  readonly loading = this.eventApi.loading;
  readonly error = this.eventApi.error;

  readonly viewMode = signal<ViewMode>('combined');
  readonly branchFilter = signal('all');

  readonly branchFilterOptions = computed<FilterOption[]>(() => [
    { key: 'all', label: 'All branches' },
    ...this.branchApi.branches().map((b) => ({ key: b.id, label: b.name })),
  ]);

  private readonly branchNameById = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.id, b.name));
    return map;
  });

  private readonly scopedEvents = computed(() => {
    const f = this.branchFilter();
    const events = this.eventApi.events();
    return f === 'all' ? events : events.filter((e) => e.branchId === f);
  });

  readonly combinedStats = computed<StatCardData[]>(() => {
    const totals = sumCounts(this.scopedEvents());
    return [
      { label: 'Confirmed', value: totals.going },
      { label: 'Maybe', value: totals.maybe },
      { label: 'Cancelled', value: totals.cancel },
      { label: 'Waitlist', value: totals.waitlist },
    ];
  });

  readonly byBranchRows = computed<BranchTotalsRow[]>(() => {
    const nameMap = this.branchNameById();
    const byBranch = new Map<string, ApiEvent[]>();
    for (const ev of this.scopedEvents()) {
      const list = byBranch.get(ev.branchId) ?? [];
      list.push(ev);
      byBranch.set(ev.branchId, list);
    }
    return [...byBranch.entries()].map(([branchId, events]) => ({
      branchId,
      branchName: nameMap.get(branchId) ?? '—',
      ...sumCounts(events),
    }));
  });

  private readonly rows = computed<EventOverviewRow[]>(() => {
    const nameMap = this.branchNameById();
    return this.scopedEvents().map((ev) => ({
      id: ev.id,
      title: ev.title,
      branchName: nameMap.get(ev.branchId) ?? '—',
      dateFull: formatDateFull(new Date(ev.startAt)),
      going: ev.going,
      maybe: ev.maybe,
      cancel: ev.cancel,
      waitlist: ev.waitlist,
    }));
  });

  readonly ctrl = new ListController<EventOverviewRow>(this.rows);

  constructor() {
    this.eventApi.load().subscribe();
    this.branchApi.load().subscribe();
  }

  setBranchFilter = (key: string) => this.branchFilter.set(key);

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  openEvent(row: EventOverviewRow): void {
    this.router.navigate(['/rsvp', row.id]);
  }
}
