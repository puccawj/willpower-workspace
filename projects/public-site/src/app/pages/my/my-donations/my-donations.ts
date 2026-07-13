import { Component, computed, inject } from '@angular/core';
import { MeApiService } from '../../../core/services/me-api.service';

interface DonationRow {
  id: string;
  typeLabel: string;
  amountLabel: string;
  date: string;
  event: string;
  certNo: string | null;
}

@Component({
  selector: 'app-my-donations',
  imports: [],
  templateUrl: './my-donations.html',
  styleUrl: './my-donations.scss',
})
export class MyDonations {
  private readonly api = inject(MeApiService);

  readonly donations = computed<DonationRow[]>(() =>
    this.api.donations().map((d) => ({
      id: d.id,
      typeLabel: d.type === 'money' ? 'Money' : 'Goods',
      amountLabel: d.type === 'money' ? `${d.currency} ${Number(d.amount).toFixed(2)}` : (d.itemDescription ?? ''),
      date: new Date(d.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      event: d.eventTitle ?? '—',
      certNo: d.certificateNo,
    })),
  );

  constructor() {
    this.api.loadDonations().subscribe();
  }
}
