import { Component, computed, inject, signal } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { MeApiService } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';
import { PillTabOption, PillTabs } from '../../../shared/pill-tabs/pill-tabs';

type DonationFilter = 'money' | 'goods' | 'all';

const FILTER_OPTIONS: PillTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'money', label: 'Money' },
  { key: 'goods', label: 'Goods' },
];

@Component({
  selector: 'app-my-donations',
  imports: [BackButton, PillTabs],
  templateUrl: './my-donations.html',
  styleUrl: '../profile-list.scss',
})
export class MyDonations {
  protected readonly meApi = inject(MeApiService);
  protected readonly opening = signal<string | null>(null);
  protected readonly filterOptions = FILTER_OPTIONS;
  protected readonly filter = signal<DonationFilter>('all');

  protected readonly filteredDonations = computed(() => {
    const rows = this.meApi.donations();
    const f = this.filter();
    return f === 'all' ? rows : rows.filter((d) => d.type === f);
  });

  constructor() {
    this.meApi.loadDonations().subscribe();
  }

  setFilter(key: string): void {
    this.filter.set(key as DonationFilter);
  }

  summarize(d: { type: 'money' | 'goods'; amount: string | null; itemDescription: string | null; currency: string }): string {
    return d.type === 'money' ? `${d.currency} ${d.amount}` : (d.itemDescription ?? 'Goods donation');
  }

  formatDate(createdAt: string): string {
    return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async downloadCertificate(id: string, url: string): Promise<void> {
    this.opening.set(id);
    try {
      await Browser.open({ url });
    } finally {
      this.opening.set(null);
    }
  }
}
