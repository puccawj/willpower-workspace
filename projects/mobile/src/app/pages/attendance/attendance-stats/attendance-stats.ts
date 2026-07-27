import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MeApiService, MyCourseSession, MyEnrollment } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-attendance-stats',
  imports: [BackButton],
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

  readonly donutStyle = computed(() => {
    const pct = this.enrollment()?.attendancePercent ?? 0;
    return `conic-gradient(var(--w-green) 0% ${pct}%, var(--w-border) ${pct}% 100%)`;
  });

  readonly missedCount = computed(() => {
    const e = this.enrollment();
    return e ? Math.max(0, e.sessionsTotal - e.sessionsAttended) : 0;
  });

  constructor() {
    this.meApi.loadEnrollments().subscribe();
    this.meApi.loadMySessions(this.offeringId).subscribe((rows) => this.sessions.set(rows));
  }

  formatSessionLabel(s: MyCourseSession): string {
    const d = new Date(s.sessionDate);
    return `Session ${s.sessionNo} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
}
