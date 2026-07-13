import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MeApiService } from '../../core/services/me-api.service';
import { PublicCourseApiService, PublicOffering } from '../../core/services/public-course-api.service';

@Component({
  selector: 'app-courses',
  imports: [RouterLink],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class Courses {
  private readonly api = inject(PublicCourseApiService);
  private readonly meApi = inject(MeApiService);
  private readonly auth = inject(AuthService);

  readonly courses = this.api.courses;
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly isStudent = computed(() => this.auth.currentUser()?.role === 'student');

  readonly expandedCourseId = signal<string | null>(null);
  readonly offerings = signal<PublicOffering[]>([]);
  readonly offeringsLoading = signal(false);
  readonly offeringsError = signal('');
  readonly enrollingOfferingId = signal<string | null>(null);
  readonly enrolledOfferingIds = signal<Set<string>>(new Set());
  readonly enrollError = signal('');

  constructor() {
    this.api.load().subscribe();
  }

  toggleEnroll(courseId: string): void {
    if (this.expandedCourseId() === courseId) {
      this.expandedCourseId.set(null);
      return;
    }

    this.expandedCourseId.set(courseId);
    this.enrollError.set('');
    this.offeringsLoading.set(true);
    this.offeringsError.set('');
    this.api.loadOfferings(courseId).subscribe({
      next: (rows) => {
        this.offerings.set(rows);
        this.offeringsLoading.set(false);
      },
      error: () => {
        this.offeringsError.set('Could not load available class times.');
        this.offeringsLoading.set(false);
      },
    });
  }

  enrollIn(offeringId: string): void {
    this.enrollingOfferingId.set(offeringId);
    this.enrollError.set('');
    this.meApi.enrollSelf(offeringId).subscribe({
      next: () => {
        this.enrollingOfferingId.set(null);
        this.enrolledOfferingIds.update((set) => new Set(set).add(offeringId));
      },
      error: (err) => {
        this.enrollingOfferingId.set(null);
        this.enrollError.set(err?.error?.message ?? 'Could not enroll you right now.');
      },
    });
  }
}
