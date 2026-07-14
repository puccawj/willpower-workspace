import { Component, signal } from '@angular/core';

const DISMISS_KEY = 'in-app-browser-notice-dismissed';

function detectInAppBrowser(ua: string): boolean {
  return /\bLine\//i.test(ua) || /FBAN|FBAV/i.test(ua) || /Instagram/i.test(ua);
}

@Component({
  selector: 'app-in-app-browser-notice',
  templateUrl: './in-app-browser-notice.html',
  styleUrl: './in-app-browser-notice.scss',
})
export class InAppBrowserNotice {
  readonly visible = signal(false);

  constructor() {
    const ua = navigator.userAgent || '';
    const alreadyDismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    this.visible.set(detectInAppBrowser(ua) && !alreadyDismissed);
  }

  dismiss(): void {
    sessionStorage.setItem(DISMISS_KEY, '1');
    this.visible.set(false);
  }
}
