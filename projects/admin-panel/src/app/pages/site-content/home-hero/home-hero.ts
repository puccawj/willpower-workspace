import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SiteContentApiService } from '../../../core/services/site-content-api.service';
import { ToastService } from '../../../core/services/toast.service';

interface HomeHeroContent {
  eyebrow: string;
  headingLine1: string;
  headingLine2: string;
  description: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  stat3Value: string;
  stat3Label: string;
}

const DEFAULT_CONTENT: HomeHeroContent = {
  eyebrow: 'Established 1932 · USA · Canada · Australia',
  headingLine1: 'Training the mind,',
  headingLine2: 'strengthening the will',
  description:
    'A center for meditation and contemplative study, guiding students toward clarity, discipline, and inner strength through timeless practice.',
  stat1Value: '3',
  stat1Label: 'Branches',
  stat2Value: '12,000+',
  stat2Label: 'Students',
  stat3Value: '90+',
  stat3Label: 'Years',
};

@Component({
  selector: 'app-home-hero',
  imports: [FormsModule],
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.scss',
})
export class HomeHero {
  private readonly api = inject(SiteContentApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly content = signal<HomeHeroContent>({ ...DEFAULT_CONTENT });

  constructor() {
    this.api.get<HomeHeroContent>('home-hero').subscribe({
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

  updateField(key: keyof HomeHeroContent, value: string): void {
    this.content.update((c) => ({ ...c, [key]: value }));
  }

  save(): void {
    this.saving.set(true);
    this.api.save('home-hero', this.content()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Home page hero updated successfully.', 'success');
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err, 'Failed to save changes.');
      },
    });
  }
}
