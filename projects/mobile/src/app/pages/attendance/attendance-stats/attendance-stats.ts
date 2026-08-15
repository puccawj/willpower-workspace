import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MeApiService, MyCourseSession, MyEnrollment } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-attendance-stats',
  imports: [BackButton, RouterLink],
  templateUrl: './attendance-stats.html',
  styleUrl: './attendance-stats.scss',
})
export class AttendanceStats {
  private readonly route = inject(ActivatedRoute);
  private readonly meApi = inject(MeApiService);

  readonly offeringId = this.route.snapshot.paramMap.get('offeringId')!;
  readonly sessions = signal<MyCourseSession[]>([]);

  readonly enrollment = computed<MyEnrollment | null>(
    () => this.meApi.enrollments().find((e) => e.offeringId === this.offeringId) ?? null,
  );

  /** Colors the donut green once attendance is over the passing mark — same signal (`isPassing`) that
   * drives the pass-mark styling on My Courses, so the two never disagree. */
  readonly donutStyle = computed(() => {
    const e = this.enrollment();
    const pct = e?.attendancePercent ?? 0;
    const color = e?.isPassing ? 'var(--w-green)' : 'var(--w-gold)';
    return `conic-gradient(${color} 0% ${pct}%, var(--w-border) ${pct}% 100%)`;
  });

  readonly missedCount = computed(() => {
    const e = this.enrollment();
    return e ? Math.max(0, e.sessionsTotal - e.sessionsAttended) : 0;
  });

  readonly certificate = computed(() => this.meApi.certificates().find((c) => c.offeringId === this.offeringId) ?? null);

  constructor() {
    this.meApi.loadEnrollments().subscribe();
    this.meApi.loadMySessions(this.offeringId).subscribe((rows) => this.sessions.set(rows));
    this.meApi.loadCertificates().subscribe();
  }

  formatSessionLabel(s: MyCourseSession): string {
    const d = new Date(s.sessionDate);
    return `Session ${s.sessionNo} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
}
