import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { ApiCourse, CourseApiService, CoursePayload } from '../../core/services/course-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { MULTISELECT_DELIM } from '../../shared/crud-modal/crud-modal';
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
  description: string;
  syllabus: string;
  category: string;
  imageUrl: string;
  totalSessions: number;
  passingLabel: string;
  offeringsCount: number;
  statusLabel: string;
  statusColor: string;
  isActive: boolean;
  prerequisiteCourseIds: string[];
  prerequisiteTitles: string;
}

function toRow(c: ApiCourse, titleById: Map<string, string>): CourseRow {
  return {
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    syllabus: c.syllabus ?? '',
    category: c.category ?? '—',
    imageUrl: c.imageUrl ?? '',
    totalSessions: c.totalSessions,
    passingLabel: `${Number(c.passingAttendancePercent)}%`,
    offeringsCount: c.offeringsCount,
    statusLabel: c.status === 'active' ? 'Active' : 'Inactive',
    statusColor: c.status === 'active' ? 'var(--w-green)' : 'var(--w-muted)',
    isActive: c.status === 'active',
    prerequisiteCourseIds: c.prerequisiteCourseIds,
    prerequisiteTitles: c.prerequisiteCourseIds.map((id) => titleById.get(id) ?? '?').join(MULTISELECT_DELIM),
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
  readonly multiselectDelim = MULTISELECT_DELIM;

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  private readonly titleById = computed(() => new Map(this.api.courses().map((c) => [c.id, c.title])));
  private readonly idByTitle = computed(() => new Map(this.api.courses().map((c) => [c.title.toLowerCase(), c.id])));

  private readonly rows = computed<CourseRow[]>(() => this.api.courses().map((c) => toRow(c, this.titleById())));

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

  goNeeds(row: CourseRow): void {
    this.router.navigate(['/courses', row.id, 'needs']);
  }

  goPhotos(row: CourseRow): void {
    this.router.navigate(['/courses', row.id, 'photos']);
  }

  goFeedback(row: CourseRow): void {
    this.router.navigate(['/courses', row.id, 'feedback']);
  }

  viewCover(row: CourseRow): void {
    if (row.imageUrl) this.imageViewer.open(row.imageUrl);
  }

  /** Options for the "Prerequisite courses" multiselect — every course except the one being edited. */
  private buildFields(excludeId?: string): FieldDef[] {
    const options = this.api
      .courses()
      .filter((c) => c.id !== excludeId)
      .map((c) => c.title);
    return [
      { key: 'title', label: 'Course title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'syllabus', label: 'Syllabus', type: 'textarea', hint: 'One topic per line — shown on the public course page.' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'totalSessions', label: 'Total sessions', type: 'number' },
      { key: 'passingAttendancePercent', label: 'Passing % (attendance)', type: 'number' },
      {
        key: 'prerequisites',
        label: 'Prerequisite courses',
        type: 'multiselect',
        options,
        hint: 'Students must have completed all of these before they can enroll. Leave empty for no prerequisite.',
      },
      { key: 'image', label: 'Cover image', type: 'image', hint: 'Recommended 800×600px or larger, landscape (4:3) — shown as a cropped card thumbnail.' },
    ];
  }

  private toPayload(values: Record<string, string | number>): CoursePayload {
    const prereqTitles = String(values['prerequisites'] ?? '')
      .split(MULTISELECT_DELIM)
      .map((t) => t.trim())
      .filter(Boolean);
    const idByTitle = this.idByTitle();
    const prerequisiteCourseIds = prereqTitles.map((t) => idByTitle.get(t.toLowerCase())).filter((id): id is string => !!id);

    return {
      title: String(values['title'] ?? '').trim(),
      description: String(values['description'] ?? '').trim() || undefined,
      syllabus: String(values['syllabus'] ?? '').trim() || undefined,
      category: String(values['category'] ?? '').trim() || undefined,
      totalSessions: Number(values['totalSessions']) || 1,
      passingAttendancePercent: Number(values['passingAttendancePercent']) || 80,
      prerequisiteCourseIds,
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
      fields: this.buildFields(),
      isEdit: false,
      values: {
        title: '',
        description: '',
        syllabus: '',
        category: '',
        totalSessions: 8,
        passingAttendancePercent: 80,
        prerequisites: '',
        image: '',
      },
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
      fields: this.buildFields(row.id),
      isEdit: true,
      values: {
        title: row.title,
        description: row.description,
        syllabus: row.syllabus,
        category: row.category === '—' ? '' : row.category,
        totalSessions: row.totalSessions,
        passingAttendancePercent: Number(row.passingLabel.replace('%', '')),
        prerequisites: row.prerequisiteTitles,
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
