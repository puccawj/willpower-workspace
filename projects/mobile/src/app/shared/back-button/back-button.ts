import { Component, Input, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-back-button',
  imports: [],
  templateUrl: './back-button.html',
  styleUrl: './back-button.scss',
})
export class BackButton {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  @Input() variant: 'inline' | 'overlay' = 'inline';

  goBack(): void {
    // location.back() silently does nothing when there's no history entry to pop to
    // (e.g. this page was the app's first navigation this session, reached directly
    // from a push notification tap) — a tap on this button then looks broken instead
    // of doing anything. Fall back to Home if the URL hasn't actually changed shortly
    // after asking history to go back.
    const urlBefore = this.location.path();
    this.location.back();
    setTimeout(() => {
      if (this.location.path() === urlBefore) {
        void this.router.navigateByUrl('/home', { replaceUrl: true });
      }
    }, 150);
  }
}
