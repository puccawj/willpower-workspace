import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, tap, throwError } from 'rxjs';
import { ApiCourse, CourseApiService } from '../../../core/services/course-api.service';
import { ApiCourseNeed, ApiCourseNeedType, CourseNeedApiService } from '../../../core/services/course-need-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ToastService } from '../../../core/services/toast.service';

const WHOLE_COURSE = 'Whole course';

interface NeedRow {
  id: string;
  title: string;
  sessionNumber: number | null;
  sessionLabel: string;
  type: ApiCourseNeedType;
  unit: string | null;
  target: number;
  received: number;
  pct: number;
  progressLabel: string;
}

function toRow(n: ApiCourseNeed): NeedRow {
  const target = Number(n.targetQuantity);
  const received = Number(n.receivedQuantity);
  const pct = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : 0;
  const unitLabel = n.type === 'money' ? 'USD' : (n.unit ?? '');
  return {
    id: n.id,
    title: n.title,
    sessionNumber: n.sessionNumber,
    sessionLabel: n.sessionNumber ? `Session ${n.sessionNumber}` : WHOLE_COURSE,
    type: n.type,
    unit: n.unit,
    target,
    received,
    pct,
    progressLabel: `${received.toLocaleString()} / ${target.toLocaleString()} ${unitLabel}`.trim(),
  };
}

@Component({
  selector: 'app-course-needs',
  imports: [],
  templateUrl: './course-needs.html',
  styleUrl: './course-needs.scss',
})
export class CourseNeeds {
  private readonly courseApi = inject(CourseApiService);
  private readonly needApi = inject(CourseNeedApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = this.needApi.loading;
  readonly error = this.needApi.error;

  private readonly courseId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  readonly course = signal<ApiCourse | null>(null);
  readonly rows = computed<NeedRow[]>(() => this.needApi.needs().map(toRow));

  private readonly sessionOptions = computed(() => {
    const total = this.course()?.totalSessions ?? 0;
    return [WHOLE_COURSE, ...Array.from({ length: total }, (_, i) => `Session ${i + 1}`)];
  });

  private parseSessionNumber(value: string | number): number | undefined {
    const label = String(value ?? '').trim();
    if (!label || label === WHOLE_COURSE) return undefined;
    const match = /^Session (\d+)$/.exec(label);
    return match ? Number(match[1]) : undefined;
  }

  constructor() {
    const id = this.courseId();
    if (id) {
      this.courseApi.getOne(id).subscribe({
        next: (c) => this.course.set(c),
        error: (err) => this.showError(err, 'Failed to load course.'),
      });
      this.needApi.load(id).subscribe();
    }
  }

  goCourses(): void {
    this.router.navigate(['/courses']);
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  addNeed(): void {
    const courseId = this.courseId();
    this.modal.open({
      title: 'Add Need',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'session', label: 'Session', type: 'select', options: this.sessionOptions() },
        { key: 'type', label: 'Type', type: 'select', options: ['Goods', 'Money'] },
        { key: 'unit', label: 'Unit (e.g. bags, pieces) — goods only', type: 'text' },
        { key: 'targetQuantity', label: 'Target quantity', type: 'number', min: 0 },
      ],
      isEdit: false,
      values: { title: '', session: WHOLE_COURSE, type: 'Goods', unit: '', targetQuantity: 1 },
      onSave: (values) => {
        const type: ApiCourseNeedType = String(values['type']).toLowerCase() === 'money' ? 'money' : 'goods';
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const targetQuantity = Number(values['targetQuantity']);
        if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
          this.toast.show('Please enter a target quantity greater than 0.', 'error');
          return throwError(() => new Error('invalid-target-quantity'));
        }
        return this.needApi
          .create(courseId, {
            title,
            sessionNumber: this.parseSessionNumber(values['session']),
            type,
            unit: type === 'goods' ? String(values['unit'] ?? '').trim() || undefined : undefined,
            targetQuantity,
          })
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to add need.') }));
      },
    });
  }

  editNeed(row: NeedRow): void {
    const courseId = this.courseId();
    this.modal.open({
      title: 'Edit Need',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'session', label: 'Session', type: 'select', options: this.sessionOptions() },
        { key: 'type', label: 'Type', type: 'select', options: ['Goods', 'Money'] },
        { key: 'unit', label: 'Unit (e.g. bags, pieces) — goods only', type: 'text' },
        { key: 'targetQuantity', label: 'Target quantity', type: 'number', min: 0 },
      ],
      isEdit: true,
      values: {
        title: row.title,
        session: row.sessionLabel,
        type: row.type === 'money' ? 'Money' : 'Goods',
        unit: row.unit ?? '',
        targetQuantity: row.target,
      },
      onSave: (values) => {
        const type: ApiCourseNeedType = String(values['type']).toLowerCase() === 'money' ? 'money' : 'goods';
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const targetQuantity = Number(values['targetQuantity']);
        if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
          this.toast.show('Please enter a target quantity greater than 0.', 'error');
          return throwError(() => new Error('invalid-target-quantity'));
        }
        return this.needApi
          .update(courseId, row.id, {
            title,
            sessionNumber: this.parseSessionNumber(values['session']),
            type,
            unit: type === 'goods' ? String(values['unit'] ?? '').trim() || undefined : undefined,
            targetQuantity,
          })
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to update need.') }));
      },
      onDelete: () =>
        this.needApi.remove(courseId, row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete need.') })),
    });
  }
}
