import { Component, inject, signal } from '@angular/core';
import { MeApiService, MyCourseSession } from '../../../core/services/me-api.service';
import { QrCamera } from '../../../shared/qr-camera/qr-camera';

@Component({
  selector: 'app-my-courses',
  imports: [QrCamera],
  templateUrl: './my-courses.html',
  styleUrl: './my-courses.scss',
})
export class MyCourses {
  private readonly api = inject(MeApiService);
  readonly enrollments = this.api.enrollments;

  readonly expandedOfferingId = signal<string | null>(null);
  readonly sessions = signal<MyCourseSession[]>([]);
  readonly sessionsLoading = signal(false);
  readonly sessionsError = signal('');

  readonly scanSessionId = signal<string | null>(null);
  readonly scanSubmitting = signal(false);
  readonly scanError = signal('');

  constructor() {
    this.api.loadEnrollments().subscribe();
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'enrolled':
        return 'In progress';
      case 'completed':
        return 'Completed';
      case 'waitlist':
        return 'Waitlisted';
      case 'dropped':
        return 'Dropped';
      default:
        return 'Not passed';
    }
  }

  statusClass(status: string): string {
    if (status === 'enrolled') return 'in-progress';
    if (status === 'completed') return 'completed';
    return 'failed';
  }

  toggleSessions(offeringId: string): void {
    if (this.expandedOfferingId() === offeringId) {
      this.expandedOfferingId.set(null);
      return;
    }

    this.expandedOfferingId.set(offeringId);
    this.scanSessionId.set(null);
    this.scanError.set('');
    this.sessionsLoading.set(true);
    this.sessionsError.set('');
    this.api.loadMySessions(offeringId).subscribe({
      next: (rows) => {
        this.sessions.set(rows);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessionsError.set('Could not load sessions right now.');
        this.sessionsLoading.set(false);
      },
    });
  }

  openScan(sessionId: string): void {
    this.scanSessionId.set(sessionId);
    this.scanError.set('');
  }

  closeScan(): void {
    this.scanSessionId.set(null);
  }

  onCodeDetected(code: string): void {
    const sessionId = this.scanSessionId();
    if (!sessionId) return;

    if (code !== sessionId) {
      this.scanError.set('This QR code is for a different session.');
      return;
    }

    this.scanSubmitting.set(true);
    this.scanError.set('');
    this.api.checkinSession(sessionId).subscribe({
      next: () => {
        this.sessions.update((rows) => rows.map((s) => (s.id === sessionId ? { ...s, checkedIn: true } : s)));
        this.scanSessionId.set(null);
        this.scanSubmitting.set(false);
      },
      error: (err) => {
        this.scanError.set(err?.error?.message ?? 'Could not check you in right now.');
        this.scanSubmitting.set(false);
      },
    });
  }
}
