import { Component, inject } from '@angular/core';
import { map, of, Observable, switchMap, tap, throwError } from 'rxjs';
import { ApiHomeBanner, HomeBannerApiService, HomeBannerPayload } from '../../../core/services/home-banner-api.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ToastService } from '../../../core/services/toast.service';

function statusOf(b: ApiHomeBanner): { label: string; color: string } {
  if (!b.isActive) return { label: 'Off', color: 'var(--w-muted)' };
  const today = new Date().toISOString().slice(0, 10);
  if (b.startDate && b.startDate > today) return { label: 'Scheduled', color: 'var(--w-gold)' };
  if (b.endDate && b.endDate < today) return { label: 'Expired', color: 'var(--w-red)' };
  return { label: 'Live', color: 'var(--w-green)' };
}

function dateRangeLabel(b: ApiHomeBanner): string {
  if (!b.startDate && !b.endDate) return 'Always shown';
  if (b.startDate && !b.endDate) return `From ${b.startDate} — no end date`;
  if (!b.startDate && b.endDate) return `Until ${b.endDate}`;
  return `${b.startDate} → ${b.endDate}`;
}

@Component({
  selector: 'app-home-banners',
  imports: [],
  templateUrl: './home-banners.html',
  styleUrl: './home-banners.scss',
})
export class HomeBanners {
  private readonly api = inject(HomeBannerApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;
  readonly rows = this.api.banners;

  readonly statusOf = statusOf;
  readonly dateRangeLabel = dateRangeLabel;

  constructor() {
    this.api.load().subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private resolvePayload(values: Record<string, string | number>): Observable<HomeBannerPayload> {
    const image = String(values['image'] ?? '');
    const payload: HomeBannerPayload = {
      imageUrl: image,
      linkUrl: String(values['linkUrl'] ?? '').trim(),
      startDate: String(values['startDate'] ?? '').trim(),
      endDate: String(values['endDate'] ?? '').trim(),
    };
    if (image.startsWith('data:')) {
      return this.uploads.uploadDataUri(image).pipe(map((url) => ({ ...payload, imageUrl: url })));
    }
    return of(payload);
  }

  toggleActive(row: ApiHomeBanner): void {
    this.api.update(row.id, { isActive: !row.isActive }).subscribe({
      error: (err) => this.showError(err, 'Failed to update banner status.'),
    });
  }

  moveBanner(index: number, direction: -1 | 1): void {
    const rows = this.rows();
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    this.api.update(a.id, { sortOrder: b.sortOrder }).subscribe({ error: (err) => this.showError(err, 'Failed to reorder banners.') });
    this.api.update(b.id, { sortOrder: a.sortOrder }).subscribe({ error: (err) => this.showError(err, 'Failed to reorder banners.') });
  }

  addBanner(): void {
    const maxOrder = this.rows().reduce((max, r) => Math.max(max, r.sortOrder), -1);
    this.modal.open({
      title: 'Add Banner',
      fields: [
        { key: 'image', label: 'Banner image', type: 'image', hint: 'Recommended 1920×600px or wider (~16:5 ratio) for a sharp full-width banner.' },
        { key: 'linkUrl', label: 'Link (optional)', type: 'text', hint: 'e.g. /events, /courses, or a full URL' },
        { key: 'startDate', label: 'Start date (optional)', type: 'date', hint: 'Leave blank to show immediately' },
        { key: 'endDate', label: 'End date (optional)', type: 'date', hint: 'Leave blank for no end date' },
      ],
      isEdit: false,
      values: { image: '', linkUrl: '', startDate: '', endDate: '' },
      onSave: (values) => {
        const image = String(values['image'] ?? '');
        if (!image) {
          this.toast.show('Please choose a banner image.', 'error');
          return throwError(() => new Error('invalid-image'));
        }
        return this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.create({ ...payload, sortOrder: maxOrder + 1 })),
          tap({ error: (err) => this.showError(err, 'Failed to add banner.') }),
        );
      },
    });
  }

  editBanner(row: ApiHomeBanner): void {
    this.modal.open({
      title: 'Edit Banner',
      fields: [
        { key: 'image', label: 'Banner image', type: 'image', hint: 'Recommended 1920×600px or wider (~16:5 ratio) for a sharp full-width banner.' },
        { key: 'linkUrl', label: 'Link (optional)', type: 'text', hint: 'e.g. /events, /courses, or a full URL' },
        { key: 'startDate', label: 'Start date (optional)', type: 'date', hint: 'Leave blank to show immediately' },
        { key: 'endDate', label: 'End date (optional)', type: 'date', hint: 'Leave blank for no end date' },
      ],
      isEdit: true,
      values: {
        image: row.imageUrl,
        linkUrl: row.linkUrl ?? '',
        startDate: row.startDate ?? '',
        endDate: row.endDate ?? '',
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.update(row.id, payload)),
          tap({ error: (err) => this.showError(err, 'Failed to update banner.') }),
        ),
      onDelete: () => this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete banner.') })),
    });
  }
}
