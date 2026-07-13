import { Signal, computed, signal } from '@angular/core';
import { ViewMode } from './models/admin.models';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';

/**
 * Reproduces the prototype's `buildToolbar()` — search, pagination, and
 * table/card view switching — as a reusable reactive controller shared by
 * every list page's <app-table-toolbar>.
 */
export class ListController<T> {
  readonly search = signal('');
  readonly view = signal<ViewMode>('table');
  readonly page = signal(1);
  readonly perPage = signal(5);
  readonly perPageOptions = [5, 10, 25];

  /** True when the viewport is narrow enough to be considered mobile — forces card view regardless of `view`. */
  readonly isMobile = signal(this.matchesMobile());

  /** What templates should actually render: always 'card' on mobile, otherwise the user's chosen `view`. */
  readonly effectiveView = computed<ViewMode>(() => (this.isMobile() ? 'card' : this.view()));

  constructor(
    private readonly source: Signal<T[]>,
    defaultView: ViewMode = 'table',
    perPage = 5,
  ) {
    this.view.set(defaultView);
    this.perPage.set(perPage);

    if (typeof window !== 'undefined') {
      const query = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
      query.addEventListener('change', (e) => this.isMobile.set(e.matches));
    }
  }

  private matchesMobile(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  }

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const items = this.source();
    if (!term) return items;
    return items.filter((item) =>
      Object.values(item as Record<string, unknown>).some((v) => {
        if (typeof v === 'string') return v.toLowerCase().includes(term);
        if (typeof v === 'number') return String(v).includes(term);
        return false;
      }),
    );
  });

  readonly total = computed(() => this.filtered().length);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage())));

  readonly currentPage = computed(() => Math.min(Math.max(1, this.page()), this.totalPages()));

  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * this.perPage();
    return this.filtered().slice(start, start + this.perPage());
  });

  readonly summaryLabel = computed(() => {
    const total = this.total();
    if (!total) return 'Showing 0–0 of 0';
    const start = (this.currentPage() - 1) * this.perPage() + 1;
    const end = Math.min(this.currentPage() * this.perPage(), total);
    return `Showing ${start}–${end} of ${total}`;
  });

  readonly pageLabel = computed(() => `Page ${this.currentPage()} of ${this.totalPages()}`);

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  setPerPage(value: number): void {
    this.perPage.set(value);
    this.page.set(1);
  }

  setView(view: ViewMode): void {
    this.view.set(view);
  }

  prev(): void {
    if (this.currentPage() > 1) this.page.set(this.currentPage() - 1);
  }

  next(): void {
    if (this.currentPage() < this.totalPages()) this.page.set(this.currentPage() + 1);
  }
}
