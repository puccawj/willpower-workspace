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

// android:windowSoftInputMode is "adjustResize" (see AndroidManifest.xml) so the WebView's
// own visible area actually shrinks when the keyboard opens — window.visualViewport can
// only detect a real resize, and "adjustPan" (tried first) doesn't produce one, since
// panning shifts the whole window instead of resizing it, silently disabling this entire
// fallback. adjustResize's own built-in browser auto-scroll-to-focused-field is what
// caused the original white-gap bug (it scrolled based on the pre-resize layout and
// overshot past the end of the document), so here we take over that scroll ourselves:
// reserve bottom space equal to the keyboard height (so a field near the end of the
// document has somewhere to scroll *to*), wait a frame for that layout change to commit,
// then scroll the focused field to a known-good position.
//
// Almost every screen in this app lives inside the tab shell's ".tab-content" — a fixed
// 100dvh flex child with its own "overflow-y: auto" (see tab-shell.scss) — NOT the
// document body. Padding document.body unconditionally (as an earlier version of this
// function did) padded an element that isn't the actual scroll container: body became
// scrollable as a second, independent scroll layer on top of .tab-content's own scroll,
// and scrollIntoView() dragged that outer body-scroll along too, exposing the padding
// itself as a big blank white gap above the keyboard — on every tab page. Padding the
// focused field's real nearest scrollable ancestor (whatever that is on a given page)
// instead of hardcoding body fixes this generally.
function findScrollParent(el: HTMLElement): HTMLElement {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.body;
}

function setupKeyboardAvoidance(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};

  let paddedEl: HTMLElement | null = null;
  const clearPadding = () => {
    if (paddedEl) {
      paddedEl.style.paddingBottom = '';
      paddedEl = null;
    }
  };

  const onViewportResize = () => {
    const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    const active = document.activeElement as HTMLElement | null;
    const isField = !!active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);

    if (keyboardHeight <= 50 || !isField) {
      clearPadding();
      return;
    }

    const scrollParent = findScrollParent(active!);
    if (paddedEl && paddedEl !== scrollParent) clearPadding();
    scrollParent.style.paddingBottom = `${keyboardHeight}px`;
    paddedEl = scrollParent;

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        active!.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }),
    );
  };

  viewport.addEventListener('resize', onViewportResize);
  return () => {
    viewport.removeEventListener('resize', onViewportResize);
    clearPadding();
  };
}

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

    const teardownKeyboardAvoidance = setupKeyboardAvoidance();

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

      // Home is always the bottom of the stack, regardless of how much
      // history piled up getting here (e.g. Home was reached via the
      // tab-root redirect above, or several drill-downs deep) — never pop
      // into whatever came before it. Only a genuine drill-down page (not a
      // tab root, not Home) pops normally via history.back().
      if (canGoBack && path !== '/home') {
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
      teardownKeyboardAvoidance();
      if (this.exitHintTimer) clearTimeout(this.exitHintTimer);
    });
  }
}
