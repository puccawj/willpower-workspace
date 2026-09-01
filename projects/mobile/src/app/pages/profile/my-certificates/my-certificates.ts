import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CertificateType, MeApiService, MyCertificate } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';
import { PillTabOption, PillTabs } from '../../../shared/pill-tabs/pill-tabs';

type CertFilter = CertificateType | 'all';

const FILTER_OPTIONS: PillTabOption[] = [
  { key: 'all', label: 'All' },
  { key: 'certificate', label: 'Course' },
  { key: 'donation_money', label: 'Money donation' },
  { key: 'donation_goods', label: 'Goods donation' },
];

@Component({
  selector: 'app-my-certificates',
  imports: [RouterLink, BackButton, PillTabs],
  templateUrl: './my-certificates.html',
  styleUrl: '../profile-list.scss',
})
export class MyCertificates {
  protected readonly meApi = inject(MeApiService);
  protected readonly filterOptions = FILTER_OPTIONS;
  protected readonly filter = signal<CertFilter>('all');

  protected readonly filteredCertificates = computed(() => {
    const rows = this.meApi.certificates();
    const f = this.filter();
    return f === 'all' ? rows : rows.filter((c) => c.templateType === f);
  });

  constructor() {
    this.meApi.loadCertificates().subscribe();
  }

  setFilter(key: string): void {
    this.filter.set(key as CertFilter);
  }

  titleFor(c: MyCertificate): string {
    return c.courseTitle ?? c.templateName;
  }
}
