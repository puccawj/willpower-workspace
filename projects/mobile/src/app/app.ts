import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PhotoViewer } from './shared/photo-viewer/photo-viewer';

const EXIT_HINT_WINDOW_MS = 2000;

// The bottom tab bar's own routes. Switching tabs via the tab bar pushes a
// fresh history entry each time (plain routerLink navigation), so the back
// stack ends up as whatever order the user happened to tap tabs in — e.g.
// Home -> Events -> Courses means back from Courses lands on Events, not
// Home. Tab roots always treat back as "go to Home" instead of popping
// history, so behavior is consistent regardless of tap order. Drilling into
// a detail page from a tab (e.g. Events -> event detail) still pushes
// normally and is unaffected — back from a detail page pops to the tab list
// it came from, via the normal history.back() path below.
const TAB_ROOTS = new Set(['/home', '/events', '/courses', '/profile']);

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PhotoViewer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly showExitHint = signal(false);
  private exitHintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!Capacitor.isNativePlatform()) return;

    const router = inject(Router);

    // Capacitor doesn't drive the Angular router from the hardware/gesture back
    // button on its own — without this listener, back press behavior is undefined
    // (often just backgrounds the app) instead of popping the router history.
    //
    // Some Android versions/OEM skins dispatch a single physical back press as
    // several rapid 'backButton' events (observed back-to-back on a Samsung
    // device, likely the legacy onBackPressed + predictive-back gesture paths
    // both firing). Debounce so one press only pops one history entry.
    let lastHandledAt = 0;
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const now = Date.now();
      if (now - lastHandledAt < 400) return;
      lastHandledAt = now;

      const path = window.location.hash.replace(/^#/, '').split('?')[0] || '/home';
      if (TAB_ROOTS.has(path) && path !== '/home') {
        this.showExitHint.set(false);
        void router.navigateByUrl('/home', { replaceUrl: true });
        return;
      }

      if (canGoBack) {
        this.showExitHint.set(false);
        window.history.back();
        return;
      }

      // At the root screen: require a second press within the hint window
      // before actually exiting, so backing out of the app can't happen by
      // accident from repeatedly tapping back.
      if (this.showExitHint()) {
        void CapacitorApp.exitApp();
        return;
      }

      this.showExitHint.set(true);
      if (this.exitHintTimer) clearTimeout(this.exitHintTimer);
      this.exitHintTimer = setTimeout(() => this.showExitHint.set(false), EXIT_HINT_WINDOW_MS);
    });

    inject(DestroyRef).onDestroy(() => {
      void listener.then((l) => l.remove());
      if (this.exitHintTimer) clearTimeout(this.exitHintTimer);
    });
  }
}
