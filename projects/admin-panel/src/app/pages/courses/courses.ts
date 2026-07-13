import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { ApiCourse, CourseApiService, CoursePayload } from '../../core/services/course-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ImageViewerService } from '../../core/services/image-viewer.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FieldDef } from '../../core/models/admin.models';

interface CourseRow {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  totalSessions: number;
  passingLabel: string;
  offeringsCount: number;
  statusLabel: string;
  statusColor: string;
  isActive: boolean;
}

const FIELDS: FieldDef[] = [
  { key: 'title', label: 'Course title', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'totalSessions', label: 'Total sessions', type: 'number' },
  { key: 'passingAttendancePercent', label: 'Passing % (attendance)', type: 'number' },
  { key: 'image', label: 'Cover image', type: 'image' },
];

function toRow(c: ApiCourse): CourseRow {
  return {
    id: c.id,
    title: c.title,
    category: c.category ?? '—',
    imageUrl: c.imageUrl ?? '',
    totalSessions: c.totalSessions,
    passingLabel: `${Number(c.passingAttendancePercent)}%`,
    offeringsCount: c.offeringsCount,
    statusLabel: c.status === 'active' ? 'Active' : 'Inactive',
    statusColor: c.status === 'active' ? 'var(--w-green)' : 'var(--w-muted)',
    isActive: c.status === 'active',
  };
}

@Component({
  selector: 'app-courses',
  imports: [TableToolbar],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class Courses {
  private readonly api = inject(CourseApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly uploads = inject(UploadApiService);
  private readonly imageViewer = inject(ImageViewerService);
  readonly roleService = inject(RoleService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  private readonly rows = computed<CourseRow[]>(() => this.api.courses().map(toRow));

  readonly ctrl = new ListController<CourseRow>(this.rows);

  constructor() {
    this.api.load().subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goSchedule(): void {
    this.router.navigate(['/schedule']);
  }

  viewCover(row: CourseRow): void {
    if (row.imageUrl) this.imageViewer.open(row.imageUrl);
  }

  private toPayload(values: Record<string, string | number>): CoursePayload {
    return {
      title: String(values['title'] ?? '').trim(),
      category: String(values['category'] ?? '').trim() || undefined,
      totalSessions: Number(values['totalSessions']) || 1,
      passingAttendancePercent: Number(values['passingAttendancePercent']) || 80,
    };
  }

  private resolvePayload(values: Record<string, string | number>): Observable<CoursePayload> {
    const payload = this.toPayload(values);
    const image = String(values['image'] ?? '');
    if (image.startsWith('data:')) {
      return this.uploads.uploadDataUri(image).pipe(map((url) => ({ ...payload, image: url })));
    }
    if (image) payload.image = image;
    return of(payload);
  }

  addCourse(): void {
    this.modal.open({
      title: 'Add Course',
      fields: FIELDS,
      isEdit: false,
      values: { title: '', category: '', totalSessions: 8, passingAttendancePercent: 80, image: '' },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.create(payload)),
          tap({ error: (err) => this.showError(err, 'Failed to create course.') }),
        ),
    });
  }

  editCourse(row: CourseRow): void {
    this.modal.open({
      title: 'Edit Course',
      fields: FIELDS,
      isEdit: true,
      values: {
        title: row.title,
        category: row.category === '—' ? '' : row.category,
        totalSessions: row.totalSessions,
        passingAttendancePercent: Number(row.passingLabel.replace('%', '')),
        image: row.imageUrl,
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.update(row.id, payload)),
          tap({ error: (err) => this.showError(err, 'Failed to update course.') }),
        ),
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete course.') })),
    });
  }
}
