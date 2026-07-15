import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, of, Observable, switchMap, tap, throwError } from 'rxjs';
import { ApiEvent, EventApiService } from '../../../core/services/event-api.service';
import { ApiEventPhoto, EventPhotoApiService } from '../../../core/services/event-photo-api.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateFull } from '../../../core/date-time.util';

@Component({
  selector: 'app-event-photos',
  imports: [],
  templateUrl: './event-photos.html',
  styleUrl: './event-photos.scss',
})
export class EventPhotos {
  private readonly eventApi = inject(EventApiService);
  private readonly photoApi = inject(EventPhotoApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = this.photoApi.loading;
  readonly error = this.photoApi.error;
  readonly rows = this.photoApi.photos;

  private readonly eventId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  readonly event = signal<ApiEvent | null>(null);
  readonly dateFull = signal('');

  constructor() {
    const id = this.eventId();
    if (id) {
      this.eventApi.getOne(id).subscribe({
        next: (ev) => {
          this.event.set(ev);
          this.dateFull.set(formatDateFull(new Date(ev.startAt)));
        },
        error: (err) => this.showError(err, 'Failed to load event.'),
      });
      this.photoApi.load(id).subscribe();
    }
  }

  goEvents(): void {
    this.router.navigate(['/events']);
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private resolveImageUrl(image: string): Observable<string> {
    return image.startsWith('data:') ? this.uploads.uploadDataUri(image) : of(image);
  }

  addPhoto(): void {
    const eventId = this.eventId();
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
          switchMap((imageUrl) => this.photoApi.create(eventId, { imageUrl, caption: caption || undefined })),
          tap({ error: (err) => this.showError(err, 'Failed to add photo.') }),
        );
      },
    });
  }

  editPhoto(row: ApiEventPhoto): void {
    const eventId = this.eventId();
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
          switchMap((imageUrl) => this.photoApi.update(eventId, row.id, { imageUrl, caption: caption || undefined })),
          tap({ error: (err) => this.showError(err, 'Failed to update photo.') }),
        );
      },
      onDelete: () =>
        this.photoApi.remove(eventId, row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete photo.') })),
    });
  }
}
