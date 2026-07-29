import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of, switchMap, tap, throwError } from 'rxjs';
import { SiteContentApiService } from '../../../core/services/site-content-api.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ToastService } from '../../../core/services/toast.service';

interface TimelineEntry {
  year: string;
  title: string;
  desc: string;
}

interface AboutContent {
  eyebrow: string;
  heroTitle: string;
  heroLead: string;
  carouselImages: string[];
  timeline: TimelineEntry[];
}

const DEFAULT_CONTENT: AboutContent = {
  eyebrow: '',
  heroTitle: '',
  heroLead: '',
  carouselImages: [],
  timeline: [],
};

@Component({
  selector: 'app-about-content',
  imports: [FormsModule],
  templateUrl: './about-content.html',
  styleUrl: './about-content.scss',
})
export class AboutContentPage {
  private readonly api = inject(SiteContentApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly content = signal<AboutContent>({ ...DEFAULT_CONTENT });

  constructor() {
    this.api.get<AboutContent>('about').subscribe({
      next: (row) => {
        this.content.set({ ...DEFAULT_CONTENT, ...row.content });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private persist(next: AboutContent, successMessage?: string): void {
    this.saving.set(true);
    this.api.save('about', next).subscribe({
      next: () => {
        this.content.set(next);
        this.saving.set(false);
        if (successMessage) this.toast.show(successMessage, 'success');
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err, 'Failed to save changes.');
      },
    });
  }

  saveHero(): void {
    this.persist(this.content(), 'About page updated successfully.');
  }

  updateField(key: 'eyebrow' | 'heroTitle' | 'heroLead', value: string): void {
    this.content.update((c) => ({ ...c, [key]: value }));
  }

  addImage(): void {
    this.modal.open({
      title: 'Add Carousel Image',
      fields: [
        { key: 'image', label: 'Image', type: 'image', hint: 'Recommended 1600×480px or wider (~10:3 ratio) to fill the banner without awkward cropping.' },
      ],
      isEdit: false,
      values: { image: '' },
      onSave: (values) => {
        const image = String(values['image'] ?? '');
        if (!image) {
          this.toast.show('Please choose an image.', 'error');
          return throwError(() => new Error('invalid-image'));
        }
        const upload$ = image.startsWith('data:') ? this.uploads.uploadDataUri(image) : of(image);
        return upload$.pipe(
          switchMap((imageUrl) => {
            const next = { ...this.content(), carouselImages: [...this.content().carouselImages, imageUrl] };
            return this.api.save('about', next).pipe(tap(() => this.content.set(next)));
          }),
          tap({ error: (err) => this.showError(err, 'Failed to add image.') }),
        );
      },
    });
  }

  removeImage(index: number): void {
    const images = this.content().carouselImages.filter((_, i) => i !== index);
    this.persist({ ...this.content(), carouselImages: images }, 'Image removed.');
  }

  addTimelineEntry(): void {
    this.modal.open({
      title: 'Add Journey Entry',
      fields: [
        { key: 'year', label: 'Year', type: 'text' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'desc', label: 'Description', type: 'textarea' },
      ],
      isEdit: false,
      values: { year: '', title: '', desc: '' },
      onSave: (values) => {
        const entry: TimelineEntry = {
          year: String(values['year'] ?? '').trim(),
          title: String(values['title'] ?? '').trim(),
          desc: String(values['desc'] ?? '').trim(),
        };
        if (!entry.year || !entry.title) {
          this.toast.show('Please enter a year and title.', 'error');
          return throwError(() => new Error('invalid-entry'));
        }
        const next = { ...this.content(), timeline: [...this.content().timeline, entry] };
        return this.api.save('about', next).pipe(
          tap({ next: () => this.content.set(next), error: (err) => this.showError(err, 'Failed to add entry.') }),
        );
      },
    });
  }

  editTimelineEntry(index: number, entry: TimelineEntry): void {
    this.modal.open({
      title: 'Edit Journey Entry',
      fields: [
        { key: 'year', label: 'Year', type: 'text' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'desc', label: 'Description', type: 'textarea' },
      ],
      isEdit: true,
      values: { year: entry.year, title: entry.title, desc: entry.desc },
      onSave: (values) => {
        const updated: TimelineEntry = {
          year: String(values['year'] ?? '').trim(),
          title: String(values['title'] ?? '').trim(),
          desc: String(values['desc'] ?? '').trim(),
        };
        if (!updated.year || !updated.title) {
          this.toast.show('Please enter a year and title.', 'error');
          return throwError(() => new Error('invalid-entry'));
        }
        const timeline = this.content().timeline.map((t, i) => (i === index ? updated : t));
        const next = { ...this.content(), timeline };
        return this.api.save('about', next).pipe(
          tap({ next: () => this.content.set(next), error: (err) => this.showError(err, 'Failed to update entry.') }),
        );
      },
      onDelete: () => {
        const timeline = this.content().timeline.filter((_, i) => i !== index);
        const next = { ...this.content(), timeline };
        return this.api.save('about', next).pipe(
          tap({ next: () => this.content.set(next), error: (err) => this.showError(err, 'Failed to delete entry.') }),
        );
      },
    });
  }
}
