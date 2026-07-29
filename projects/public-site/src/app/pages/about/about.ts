import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BranchApiService } from '../../core/services/branch-api.service';
import { SiteContentApiService } from '../../core/services/site-content-api.service';

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
  eyebrow: 'Since 1932',
  heroTitle: 'A discipline of the heart, carried across generations',
  heroLead:
    'The Willpower Institute preserves a lineage of meditation teaching devoted to cultivating willpower — the steady, patient strength that turns intention into daily practice. What began as a single hall now welcomes students on three continents.',
  carouselImages: ['https://images.unsplash.com/photo-1665849050332-8d5d7e59afb6?q=80&w=1600&auto=format&fit=crop'],
  timeline: [],
};

const AUTO_ADVANCE_MS = 6000;

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About implements OnDestroy {
  private readonly branchApi = inject(BranchApiService);
  private readonly siteContent = inject(SiteContentApiService);
  readonly branches = this.branchApi.branches;

  readonly content = signal<AboutContent>(DEFAULT_CONTENT);
  readonly activeSlide = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.branchApi.load().subscribe();
    this.siteContent.get<Partial<AboutContent>>('about').subscribe({
      next: (data) => {
        const merged: AboutContent = {
          eyebrow: data.eyebrow || DEFAULT_CONTENT.eyebrow,
          heroTitle: data.heroTitle || DEFAULT_CONTENT.heroTitle,
          heroLead: data.heroLead || DEFAULT_CONTENT.heroLead,
          carouselImages: data.carouselImages?.length ? data.carouselImages : DEFAULT_CONTENT.carouselImages,
          timeline: data.timeline?.length ? data.timeline : DEFAULT_CONTENT.timeline,
        };
        this.content.set(merged);
        this.startAutoAdvance();
      },
      error: () => this.startAutoAdvance(),
    });
  }

  private startAutoAdvance(): void {
    if (this.content().carouselImages.length <= 1) return;
    this.timer = setInterval(() => this.next(), AUTO_ADVANCE_MS);
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
  }

  next(): void {
    const total = this.content().carouselImages.length;
    this.activeSlide.set((this.activeSlide() + 1) % total);
  }

  prev(): void {
    const total = this.content().carouselImages.length;
    this.activeSlide.set((this.activeSlide() - 1 + total) % total);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
