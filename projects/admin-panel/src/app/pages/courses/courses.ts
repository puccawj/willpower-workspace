import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiCourse, CourseApiService, CoursePayload } from '../../core/services/course-api.service';
import { CourseCategoryApiService } from '../../core/services/course-category-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { MULTISELECT_DELIM } from '../../shared/crud-modal/crud-modal';
import { ImageViewerService } from '../../core/services/image-viewer.service';
import { ConfirmService } from '../../core/services/confirm.service';
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
  categoryId: string;
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
    categoryId: c.categoryId ?? '',
    category: c.categoryName ?? '—',
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
  private readonly categoryApi = inject(CourseCategoryApiService);
  private readonly modal = inject(CrudModalService);
  private readonly confirmSvc = inject(ConfirmService);
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
    this.categoryApi.load().subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goOverview(row: CourseRow): void {
    this.router.navigate(['/courses', row.id]);
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
  private buildFields(excludeId?: string, currentCategoryId?: string): FieldDef[] {
    const options = this.api
      .courses()
      .filter((c) => c.id !== excludeId)
      .map((c) => c.title);
    const categoryOptions = this.categoryApi
      .categories()
      .filter((c) => c.active || c.id === currentCategoryId)
      .map((c) => ({ id: c.id, label: c.name }));
    return [
      { key: 'title', label: 'Course title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'syllabus', label: 'Syllabus', type: 'textarea', hint: 'One topic per line — shown on the public course page.' },
      {
        key: 'category',
        label: 'Category',
        type: 'typeahead',
        relOptions: categoryOptions,
        hint: 'Manage the list under Course Categories.',
      },
      { key: 'totalSessions', label: 'Total sessions', type: 'number' },
      { key: 'passingAttendancePercent', label: 'Passing % (attendance)', type: 'number' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['Active', 'Inactive'],
        hint: 'Inactive hides every offering of this course from the public site, regardless of their own status.',
      },
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
      categoryId: String(values['category'] ?? '').trim() || undefined,
      totalSessions: Number(values['totalSessions']) || 1,
      passingAttendancePercent: Number(values['passingAttendancePercent']) || 80,
      status: String(values['status'] ?? 'Active') === 'Inactive' ? 'inactive' : 'active',
      prerequisiteCourseIds,
    };
  }

  /** Confirms before actually deactivating — inactivating hides every offering of this course from
   * the public site regardless of the offering's own status, so it's worth a deliberate check. */
  private async confirmIfDeactivating(values: Record<string, string | number>, wasActive: boolean, offeringsCount: number): Promise<boolean> {
    const goingInactive = String(values['status'] ?? 'Active') === 'Inactive';
    if (!wasActive || !goingInactive) return true;
    return this.confirmSvc.ask(
      `This course has ${offeringsCount} offering${offeringsCount === 1 ? '' : 's'}. Setting it to Inactive will hide ${offeringsCount === 1 ? 'it' : 'all of them'} from the public site immediately, even ones marked Published.`,
      { title: 'Deactivate Course', confirmLabel: 'Set Inactive', danger: true },
    );
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
        status: 'Active',
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
      fields: this.buildFields(row.id, row.categoryId),
      isEdit: true,
      values: {
        title: row.title,
        description: row.description,
        syllabus: row.syllabus,
        category: row.categoryId,
        totalSessions: row.totalSessions,
        passingAttendancePercent: Number(row.passingLabel.replace('%', '')),
        status: row.isActive ? 'Active' : 'Inactive',
        prerequisites: row.prerequisiteTitles,
        image: row.imageUrl,
      },
      onSave: (values) =>
        from(this.confirmIfDeactivating(values, row.isActive, row.offeringsCount)).pipe(
          switchMap((ok) => (ok ? this.resolvePayload(values) : throwError(() => new Error('deactivate-declined')))),
          switchMap((payload) => this.api.update(row.id, payload)),
          tap({
            error: (err) => {
              if ((err as Error)?.message !== 'deactivate-declined') this.showError(err, 'Failed to update course.');
            },
          }),
        ),
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete course.') })),
    });
  }
}
