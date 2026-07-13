import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicEventApiService } from '../../../core/services/public-event-api.service';

type FilterKey = 'upcoming' | 'live' | 'past' | 'all';

@Component({
  selector: 'app-event-list',
  imports: [RouterLink],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  private readonly api = inject(PublicEventApiService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'live', label: 'Live' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All events' },
  ];

  readonly filter = signal<FilterKey>('upcoming');

  readonly events = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.api.events() : this.api.events().filter((ev) => ev.when === f);
  });

  constructor() {
    this.api.load().subscribe();
  }

  setFilter(key: FilterKey): void {
    this.filter.set(key);
  }
}
