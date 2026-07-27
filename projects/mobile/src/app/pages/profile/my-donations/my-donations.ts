import { Component, inject } from '@angular/core';
import { MeApiService } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-my-donations',
  imports: [BackButton],
  templateUrl: './my-donations.html',
  styleUrl: '../profile-list.scss',
})
export class MyDonations {
  protected readonly meApi = inject(MeApiService);

  constructor() {
    this.meApi.loadDonations().subscribe();
  }

  summarize(d: { type: 'money' | 'goods'; amount: string | null; itemDescription: string | null; currency: string }): string {
    return d.type === 'money' ? `${d.currency} ${d.amount}` : (d.itemDescription ?? 'Goods donation');
  }

  formatDate(createdAt: string): string {
    return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
