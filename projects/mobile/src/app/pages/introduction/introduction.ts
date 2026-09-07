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
    headline: 'One institute, many branches',
    body: 'Explore courses and events across our United States, Canada, and Australia branches — all from one app.',
  },
  {
    img: 'https://images.unsplash.com/photo-1772034292097-447be2dd32ea?q=80&w=800&auto=format&fit=crop',
    headline: 'Enroll, attend, and earn your certificate',
    body: 'Browse structured courses, enroll in the ones you need, and track your attendance. See every course you’re taking — and every one you’ve completed — in My Learning, with a certificate for each milestone reached.',
  },
  {
    img: 'https://images.unsplash.com/photo-1716805825299-70bcd837605e?q=80&w=800&auto=format&fit=crop',
    headline: 'RSVP, check in, and revisit your journey',
    body: 'Reserve your spot at upcoming events, check in with a quick QR scan, and look back at your full RSVP and attendance history anytime.',
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
