import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { ApiCourse, CourseApiService, CoursePayload } from '../../core/services/course-api.service';
import { ApiOffering, ApiOfferingStatus, OfferingApiService, OfferingPayload } from '../../core/services/offering-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { ImageViewerService } from '../../core/services/image-viewer.service';
import { MULTISELECT_DELIM } from '../../shared/crud-modal/crud-modal';
import { FieldDef } from '../../core/models/admin.models';

const STATUS_COLOR: Record<ApiOfferingStatus, string> = {
  draft: 'var(--w-muted)',
  scheduled: 'var(--w-green)',
  ongoing: 'var(--w-gold)',
  completed: 'var(--w-ink-soft)',
  cancelled: 'var(--w-red)',
};
const STATUS_OPTIONS = ['Draft', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
const STATUS_TO_API: Record<string, ApiOfferingStatus> = {
  Draft: 'draft',
  Scheduled: 'scheduled',
  Ongoing: 'ongoing',
  Completed: 'completed',
  Cancelled: 'cancelled',
};
const STATUS_LABEL: Record<ApiOfferingStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface OfferingListRow {
  id: string;
  branchName: string;
  instructorName: string;
  dateRangeLabel: string;
  enrolledCount: number;
  capacity: number;
  modeLabel: string;
  statusKey: ApiOfferingStatus;
  statusLabel: string;
  statusColor: string;
}

function toRow(o: ApiOffering): OfferingListRow {
  return {
    id: o.id,
    branchName: o.branchName,
    instructorName: o.instructorName ?? 'Unassigned',
    dateRangeLabel: `${formatDate(o.startDate)} – ${formatDate(o.endDate)}`,
    enrolledCount: o.enrolledCount,
    capacity: o.capacity ?? 0,
    modeLabel: o.mode === 'onsite' ? 'Onsite' : 'Online',
    statusKey: o.status,
    statusLabel: STATUS_LABEL[o.status],
    statusColor: STATUS_COLOR[o.status],
  };
}

@Component({
  selector: 'app-course-overview',
  imports: [],
  templateUrl: './course-overview.html',
  styleUrl: './course-overview.scss',
})
export class CourseOverview {
  private readonly courseApi = inject(CourseApiService);
  private readonly offeringApi = inject(OfferingApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly userApi = inject(UserApiService);
  private readonly modal = inject(CrudModalService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);
  private readonly imageViewer = inject(ImageViewerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);
  readonly statusColors = STATUS_COLOR;

  private readonly courseId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });

  readonly course = signal<ApiCourse | null>(null);
  readonly loadingCourse = signal(true);

  readonly offerings = computed<OfferingListRow[]>(() =>
    this.offeringApi.offerings().filter((o) => o.courseId === this.courseId()).map(toRow),
  );
  readonly loading = this.offeringApi.loading;
  readonly error = this.offeringApi.error;

  private readonly branchOptions = computed(() => this.branchApi.branches().map((b) => ({ id: b.id, label: b.name })));
  private readonly instructors = computed(() => this.userApi.users().filter((u) => u.role === 'instructor'));
  private readonly instructorOptions = computed(() =>
    this.instructors().map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` })),
  );

  readonly syllabusLines = computed(() => (this.course()?.syllabus ?? '').split('\n').map((l) => l.trim()).filter(Boolean));
  readonly passingPercent = computed(() => (this.course() ? Number(this.course()!.passingAttendancePercent) : 0));
  readonly prerequisiteTitles = computed(() => {
    const c = this.course();
    if (!c) return '';
    const titleById = new Map(this.courseApi.courses().map((x) => [x.id, x.title]));
    return c.prerequisiteCourseIds.map((id) => titleById.get(id) ?? '?').join(', ');
  });

  constructor() {
    const id = this.courseId();
    if (id) {
      this.loadCourse(id);
      this.offeringApi.load().subscribe();
      this.branchApi.load().subscribe();
      this.userApi.load().subscribe();
      this.courseApi.load().subscribe();
    }
  }

  private loadCourse(id: string): void {
    this.loadingCourse.set(true);
    this.courseApi.getOne(id).subscribe({
      next: (c) => {
        this.course.set(c);
        this.loadingCourse.set(false);
      },
      error: (err) => {
        this.showError(err, 'Failed to load course.');
        this.loadingCourse.set(false);
      },
    });
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  goCourses(): void {
    this.router.navigate(['/courses']);
  }

  goWorkspace(row: OfferingListRow): void {
    this.router.navigate(['/courses', this.courseId(), 'offerings', row.id]);
  }

  viewCover(): void {
    const url = this.course()?.imageUrl;
    if (url) this.imageViewer.open(url);
  }

  // ---- Edit course template (same field set as the Courses list page) ----

  private courseFields(): FieldDef[] {
    const excludeId = this.courseId();
    const options = this.courseApi
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

  private resolveCoursePayload(values: Record<string, string | number>): Observable<CoursePayload> {
    const idByTitle = new Map(this.courseApi.courses().map((c) => [c.title.toLowerCase(), c.id]));
    const prereqTitles = String(values['prerequisites'] ?? '')
      .split(MULTISELECT_DELIM)
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: CoursePayload = {
      title: String(values['title'] ?? '').trim(),
      description: String(values['description'] ?? '').trim() || undefined,
      syllabus: String(values['syllabus'] ?? '').trim() || undefined,
      category: String(values['category'] ?? '').trim() || undefined,
      totalSessions: Number(values['totalSessions']) || 1,
      passingAttendancePercent: Number(values['passingAttendancePercent']) || 80,
      prerequisiteCourseIds: prereqTitles.map((t) => idByTitle.get(t.toLowerCase())).filter((id): id is string => !!id),
    };

    const image = String(values['image'] ?? '');
    if (image.startsWith('data:')) {
      return this.uploads.uploadDataUri(image).pipe(map((url) => ({ ...payload, image: url })));
    }
    if (image) payload.image = image;
    return of(payload);
  }

  editCourse(): void {
    const c = this.course();
    if (!c) return;
    this.modal.open({
      title: 'Edit Course',
      fields: this.courseFields(),
      isEdit: true,
      values: {
        title: c.title,
        description: c.description ?? '',
        syllabus: c.syllabus ?? '',
        category: c.category ?? '',
        totalSessions: c.totalSessions,
        passingAttendancePercent: Number(c.passingAttendancePercent),
        prerequisites: this.prerequisiteTitles(),
        image: c.imageUrl ?? '',
      },
      onSave: (values) =>
        this.resolveCoursePayload(values).pipe(
          switchMap((payload) => this.courseApi.update(c.id, payload)),
          tap({
            next: () => this.loadCourse(c.id),
            error: (err) => this.showError(err, 'Failed to update course.'),
          }),
        ),
    });
  }

  // ---- Quick-create offering ----

  private offeringFields(): FieldDef[] {
    return [
      { key: 'branch', label: 'Branch', type: 'typeahead', relOptions: this.branchOptions() },
      { key: 'instructor', label: 'Instructor', type: 'typeahead', relOptions: this.instructorOptions(), hint: 'Optional' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'capacity', label: 'Capacity', type: 'number' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Onsite', 'Online'] },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    ];
  }

  private ensureBranchesLoaded(): Observable<unknown> {
    return this.branchApi.branches().length ? of(null) : this.branchApi.load();
  }

  newOffering(): void {
    this.ensureBranchesLoaded().subscribe(() => {
      this.modal.open({
        title: 'New Offering',
        fields: this.offeringFields(),
        isEdit: false,
        values: {
          branch: this.branchOptions()[0]?.id ?? '',
          instructor: '',
          startDate: '',
          endDate: '',
          capacity: 20,
          location: '',
          mode: 'Onsite',
          status: 'Draft',
        },
        onSave: (values) => {
          const payload: OfferingPayload = {
            courseId: this.courseId(),
            branchId: String(values['branch'] ?? '').trim(),
            startDate: String(values['startDate'] ?? ''),
            endDate: String(values['endDate'] ?? ''),
            mode: String(values['mode'] ?? 'Onsite').toLowerCase() as OfferingPayload['mode'],
            status: STATUS_TO_API[String(values['status'] ?? '')] ?? 'draft',
          };
          const instructorId = String(values['instructor'] ?? '').trim();
          if (instructorId) payload.instructorId = instructorId;
          const location = String(values['location'] ?? '').trim();
          if (location) payload.location = location;
          const capacity = Number(values['capacity']);
          if (capacity > 0) payload.capacity = capacity;

          return this.offeringApi.create(payload).pipe(tap({ error: (err) => this.showError(err, 'Failed to create offering.') }));
        },
      });
    });
  }
}
