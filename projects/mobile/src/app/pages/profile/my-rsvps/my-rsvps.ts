import { Component, computed, inject, signal } from '@angular/core';
import { MeApiService, MyRsvpStatus } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';
import { PillTabOption, PillTabs } from '../../../shared/pill-tabs/pill-tabs';

type RsvpFilter = MyRsvpStatus | 'all';

const FILTER_OPTIONS: PillTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'confirm', label: 'Confirmed' },
  { key: 'maybe', label: 'Maybe' },
  { key: 'cancel', label: 'Cancelled' },
];

@Component({
  selector: 'app-my-rsvps',
  imports: [BackButton, PillTabs],
  templateUrl: './my-rsvps.html',
  styleUrl: '../profile-list.scss',
})
export class MyRsvps {
  protected readonly meApi = inject(MeApiService);
  protected readonly filterOptions = FILTER_OPTIONS;
  protected readonly filter = signal<RsvpFilter>('all');

  protected readonly filteredEvents = computed(() => {
    const rows = this.meApi.events();
    const f = this.filter();
    return f === 'all' ? rows : rows.filter((e) => e.rsvpStatus === f);
  });

  constructor() {
    this.meApi.loadEvents().subscribe();
  }

  setFilter(key: string): void {
    this.filter.set(key as RsvpFilter);
  }

  formatDate(startAt: string): string {
    return new Date(startAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
