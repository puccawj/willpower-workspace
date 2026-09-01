import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeApiService, MyEnrollment } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';
import { PillTabOption, PillTabs } from '../../../shared/pill-tabs/pill-tabs';

type CourseFilter = 'in_progress' | 'closed' | 'passed' | 'all';

const FILTER_OPTIONS: PillTabOption[] = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'closed', label: 'Closed' },
  { key: 'passed', label: 'Passed' },
  { key: 'all', label: 'All' },
];

/** 'enrolled'/'waitlist' means still attending; anything else means the offering has concluded
 * for this student one way or another. */
function isInProgress(e: MyEnrollment): boolean {
  return e.status === 'enrolled' || e.status === 'waitlist';
}

@Component({
  selector: 'app-my-courses',
  imports: [RouterLink, BackButton, PillTabs],
  templateUrl: './my-courses.html',
  styleUrl: '../profile-list.scss',
})
export class MyCourses {
  protected readonly meApi = inject(MeApiService);
  protected readonly filterOptions = FILTER_OPTIONS;
  protected readonly filter = signal<CourseFilter>('in_progress');

  protected readonly filteredEnrollments = computed(() => {
    const rows = this.meApi.enrollments();
    switch (this.filter()) {
      case 'in_progress':
        return rows.filter(isInProgress);
      case 'closed':
        return rows.filter((e) => !isInProgress(e));
      case 'passed':
        return rows.filter((e) => e.isPassing);
      case 'all':
        return rows;
    }
  });

  constructor() {
    this.meApi.loadEnrollments().subscribe();
    this.meApi.loadCertificates().subscribe();
  }

  setFilter(key: string): void {
    this.filter.set(key as CourseFilter);
  }

  certificateForOffering(offeringId: string) {
    return this.meApi.certificates().find((c) => c.offeringId === offeringId) ?? null;
  }
}
