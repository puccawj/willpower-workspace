import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, of, Observable, switchMap, tap, throwError } from 'rxjs';
import { ApiCourse, CourseApiService } from '../../../core/services/course-api.service';
import { ApiCoursePhoto, CoursePhotoApiService } from '../../../core/services/course-photo-api.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-course-photos',
  imports: [],
  templateUrl: './course-photos.html',
  styleUrl: './course-photos.scss',
})
export class CoursePhotos {
  private readonly courseApi = inject(CourseApiService);
  private readonly photoApi = inject(CoursePhotoApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = this.photoApi.loading;
  readonly error = this.photoApi.error;
  readonly rows = this.photoApi.photos;

  private readonly courseId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  readonly course = signal<ApiCourse | null>(null);

  constructor() {
    const id = this.courseId();
    if (id) {
      this.courseApi.getOne(id).subscribe({
        next: (c) => this.course.set(c),
        error: (err) => this.showError(err, 'Failed to load course.'),
      });
      this.photoApi.load(id).subscribe();
    }
  }

  goCourses(): void {
    this.router.navigate(['/courses']);
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private resolveImageUrl(image: string): Observable<string> {
    return image.startsWith('data:') ? this.uploads.uploadDataUri(image) : of(image);
  }

  addPhoto(): void {
    const courseId = this.courseId();
    this.modal.open({
      title: 'Add Photo',
      fields: [
        { key: 'image', label: 'Photo', type: 'image' },
        { key: 'caption', label: 'Caption (optional)', type: 'text' },
      ],
      isEdit: false,
      values: { image: '', caption: '' },
      onSave: (values) => {
        const image = String(values['image'] ?? '');
        if (!image) {
          this.toast.show('Please choose a photo.', 'error');
          return throwError(() => new Error('invalid-image'));
        }
        const caption = String(values['caption'] ?? '').trim();
        return this.resolveImageUrl(image).pipe(
          switchMap((imageUrl) => this.photoApi.create(courseId, { imageUrl, caption: caption || undefined })),
          tap({ error: (err) => this.showError(err, 'Failed to add photo.') }),
        );
      },
    });
  }

  editPhoto(row: ApiCoursePhoto): void {
    const courseId = this.courseId();
    this.modal.open({
      title: 'Edit Photo',
      fields: [
        { key: 'image', label: 'Photo', type: 'image' },
        { key: 'caption', label: 'Caption', type: 'text' },
      ],
      isEdit: true,
      values: { image: row.imageUrl, caption: row.caption ?? '' },
      onSave: (values) => {
        const image = String(values['image'] ?? '');
        const caption = String(values['caption'] ?? '').trim();
        return this.resolveImageUrl(image).pipe(
          switchMap((imageUrl) => this.photoApi.update(courseId, row.id, { imageUrl, caption: caption || undefined })),
          tap({ error: (err) => this.showError(err, 'Failed to update photo.') }),
        );
      },
      onDelete: () =>
        this.photoApi.remove(courseId, row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete photo.') })),
    });
  }
}
