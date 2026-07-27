import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';

const ONBOARDED_KEY = 'willpower.onboarded';

interface Step {
  img: string;
  headline: string;
  body: string;
}

const STEPS: Step[] = [
  {
    img: 'https://images.unsplash.com/photo-1749642955698-ebe5e4579034?q=80&w=800&auto=format&fit=crop',
    headline: 'Train the mind, strengthen the will',
    body: 'A center for meditation and contemplative study, guiding you toward clarity and inner discipline.',
  },
  {
    img: 'https://images.unsplash.com/photo-1772034292097-447be2dd32ea?q=80&w=800&auto=format&fit=crop',
    headline: 'Structured courses, real progress',
    body: 'Follow guided courses at your own pace, track your attendance, and earn certificates as you complete each milestone.',
  },
  {
    img: 'https://images.unsplash.com/photo-1716805825299-70bcd837605e?q=80&w=800&auto=format&fit=crop',
    headline: 'Stay connected to your Sangha',
    body: "RSVP to events, check in with a simple QR scan, and see your community's journey unfold together.",
  },
];

@Component({
  selector: 'app-introduction',
  imports: [],
  templateUrl: './introduction.html',
  styleUrl: './introduction.scss',
})
export class Introduction {
  private readonly router = inject(Router);

  readonly steps = STEPS;
  readonly stepIndex = signal(0);
  readonly isLast = () => this.stepIndex() === STEPS.length - 1;

  next(): void {
    if (!this.isLast()) {
      this.stepIndex.update((i) => i + 1);
      return;
    }
    void Preferences.set({ key: ONBOARDED_KEY, value: '1' });
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
