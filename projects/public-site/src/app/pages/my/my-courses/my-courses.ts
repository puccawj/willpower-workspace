import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeApiService, MyCourseSession } from '../../../core/services/me-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { QrCamera } from '../../../shared/qr-camera/qr-camera';

@Component({
  selector: 'app-my-courses',
  imports: [QrCamera, RouterLink],
  templateUrl: './my-courses.html',
  styleUrl: './my-courses.scss',
})
export class MyCourses {
  private readonly api = inject(MeApiService);
  private readonly toast = inject(ToastService);
  readonly enrollments = this.api.enrollments;
  readonly certificates = this.api.certificates;

  readonly expandedOfferingId = signal<string | null>(null);
  readonly sessions = signal<MyCourseSession[]>([]);
  readonly sessionsLoading = signal(false);
  readonly sessionsError = signal('');

  /**
   * Single "scan first, resolve after" entry point (matches mobile's model): open the camera once,
   * try event check-in then session check-in against whatever code was scanned, and surface a clear
   * error if neither matches — instead of requiring the exact session row to be open before scanning.
   */
  readonly scanOpen = signal(false);
  readonly scanSubmitting = signal(false);
  readonly scanError = signal('');

  constructor() {
    this.api.loadEnrollments().subscribe();
    this.api.loadCertificates().subscribe();
  }

  certificateForOffering(offeringId: string) {
    return this.certificates().find((c) => c.offeringId === offeringId) ?? null;
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

  openScan(): void {
    this.scanOpen.set(true);
    this.scanError.set('');
  }

  closeScan(): void {
    this.scanOpen.set(false);
  }

  /** Scan-first-resolve-after: try the code as an event check-in, fall back to a session check-in, else error. */
  onCodeDetected(code: string): void {
    if (this.scanSubmitting()) return;
    this.scanSubmitting.set(true);
    this.scanError.set('');

    this.api.checkinEvent(code).subscribe({
      next: (res) => this.onScanSuccess(res.title, res.alreadyCheckedIn),
      error: () => {
        this.api.checkinSession(code).subscribe({
          next: (res) => {
            this.sessions.update((rows) => rows.map((s) => (s.id === code ? { ...s, checkedIn: true } : s)));
            this.onScanSuccess(res.title, res.alreadyCheckedIn);
          },
          error: () => {
            this.scanSubmitting.set(false);
            this.scanError.set("That doesn't look like a valid Willpower Institute check-in code.");
          },
        });
      },
    });
  }

  private onScanSuccess(title: string, alreadyCheckedIn: boolean): void {
    this.scanSubmitting.set(false);
    this.scanOpen.set(false);
    this.toast.show(alreadyCheckedIn ? `You're already checked in to ${title}.` : `Checked in to ${title}!`, 'success');
  }
}
