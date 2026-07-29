import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { tap, throwError } from 'rxjs';
import { SiteContentApiService } from '../../../core/services/site-content-api.service';
import { CrudModalService } from '../../../core/services/crud-modal.service';
import { ToastService } from '../../../core/services/toast.service';

interface PolicySection {
  id: string;
  title: string;
  bodyHtml: string;
}

interface PrivacyPolicyContent {
  lastUpdated: string;
  lead: string;
  sections: PolicySection[];
}

const DEFAULT_CONTENT: PrivacyPolicyContent = { lastUpdated: '', lead: '', sections: [] };

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

@Component({
  selector: 'app-privacy-policy-content',
  imports: [FormsModule],
  templateUrl: './privacy-policy-content.html',
  styleUrl: './privacy-policy-content.scss',
})
export class PrivacyPolicyContentPage {
  private readonly api = inject(SiteContentApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly content = signal<PrivacyPolicyContent>({ ...DEFAULT_CONTENT });

  constructor() {
    this.api.get<PrivacyPolicyContent>('privacy-policy').subscribe({
      next: (row) => {
        this.content.set({ ...DEFAULT_CONTENT, ...row.content });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  updateField(key: 'lastUpdated' | 'lead', value: string): void {
    this.content.update((c) => ({ ...c, [key]: value }));
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private persist(next: PrivacyPolicyContent, successMessage?: string): void {
    this.saving.set(true);
    this.api.save('privacy-policy', next).subscribe({
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

  saveTop(): void {
    this.persist(this.content(), 'Privacy Policy updated successfully.');
  }

  private uniqueId(title: string, excludeIndex?: number): string {
    const base = slugify(title);
    const existing = new Set(this.content().sections.filter((_, i) => i !== excludeIndex).map((s) => s.id));
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  addSection(): void {
    this.modal.open({
      title: 'Add Section',
      fields: [
        { key: 'title', label: 'Section title', type: 'text' },
        { key: 'bodyHtml', label: 'Content (HTML — supports <p>, <ul>/<li>, <a>, <strong>)', type: 'textarea' },
      ],
      isEdit: false,
      values: { title: '', bodyHtml: '' },
      onSave: (values) => {
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a section title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const section: PolicySection = { id: this.uniqueId(title), title, bodyHtml: String(values['bodyHtml'] ?? '').trim() };
        const next = { ...this.content(), sections: [...this.content().sections, section] };
        return this.api.save('privacy-policy', next).pipe(
          tap({ next: () => this.content.set(next), error: (err) => this.showError(err, 'Failed to add section.') }),
        );
      },
    });
  }

  editSection(index: number, section: PolicySection): void {
    this.modal.open({
      title: 'Edit Section',
      fields: [
        { key: 'title', label: 'Section title', type: 'text' },
        { key: 'bodyHtml', label: 'Content (HTML — supports <p>, <ul>/<li>, <a>, <strong>)', type: 'textarea' },
      ],
      isEdit: true,
      values: { title: section.title, bodyHtml: section.bodyHtml },
      onSave: (values) => {
        const title = String(values['title'] ?? '').trim();
        if (!title) {
          this.toast.show('Please enter a section title.', 'error');
          return throwError(() => new Error('invalid-title'));
        }
        const updated: PolicySection = {
          id: title === section.title ? section.id : this.uniqueId(title, index),
          title,
          bodyHtml: String(values['bodyHtml'] ?? '').trim(),
        };
        const sections = this.content().sections.map((s, i) => (i === index ? updated : s));
        const next = { ...this.content(), sections };
        return this.api.save('privacy-policy', next).pipe(
          tap({ next: () => this.content.set(next), error: (err) => this.showError(err, 'Failed to update section.') }),
        );
      },
      onDelete: () => {
        const sections = this.content().sections.filter((_, i) => i !== index);
        const next = { ...this.content(), sections };
        return this.api.save('privacy-policy', next).pipe(
          tap({ next: () => this.content.set(next), error: (err) => this.showError(err, 'Failed to delete section.') }),
        );
      },
    });
  }

  moveSection(index: number, direction: -1 | 1): void {
    const sections = [...this.content().sections];
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    this.persist({ ...this.content(), sections });
  }
}
