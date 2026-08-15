import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PhotoViewer } from './shared/photo-viewer/photo-viewer';
import { ToastHost } from './shared/toast-host/toast-host';
import { ConfirmDialog } from './shared/confirm-dialog/confirm-dialog';

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

// This went through several wrong turns before landing here — see CHANGELOG.md for the full
// history. In short, every standard Android keyboard-visibility mechanism failed specifically on
// the test device (a Samsung Galaxy Note 9, Android 10 / API 29, whose One UI insets
// implementation is known to be quirky): android:windowSoftInputMode="adjustResize" was found —
// via live Chrome DevTools inspection of the actual running WebView, not screenshots — to report
// a bogus, far-too-small viewport height once the keyboard opened; @capacitor/keyboard's
// keyboardWillShow/Hide events never fired at all (they need WindowInsetsAnimationCompat, API
// 30+); and even that plugin's older resizeOnFullScreen fallback measurably never resized the
// WebView's viewport on this device either (confirmed live: window.innerHeight stayed at its
// resting value with the keyboard open). All three depend on some inset-dispatch callback this
// OS/OEM combination doesn't deliver.
//
// Fix: MainActivity.java registers its own ViewTreeObserver.OnGlobalLayoutListener and measures
// View.getWindowVisibleDisplayFrame() directly — the ~2012-era technique that predates and
// doesn't depend on any of the above, reliable back to API 1 — and dispatches a plain
// "nativeKeyboardHeightChange" window event with the real height whenever it changes. windowSoft
// InputMode is "adjustPan" (AndroidManifest.xml) so nothing about the page resizes on its own;
// window.innerHeight stays the real, untouched, full-page height, and this native height is the
// only number we trust for where the keyboard actually starts.
//
// Almost every screen in this app lives inside the tab shell's ".tab-content" — a fixed
// 100dvh flex child with its own "overflow-y: auto" (see tab-shell.scss) — but course-detail
// and event-detail are top-level routes outside the tab shell (see app.routes.ts) and scroll
// via document.scrollingElement instead. Walk up from the field to find whichever one actually
// applies, rather than hardcoding either.
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

const FIELD_BOTTOM_MARGIN_PX = 24;

interface NativeKeyboardHeightEvent extends Event {
  keyboardHeight: number;
  visible: boolean;
}

function setupKeyboardAvoidance(): () => void {
  let paddedEl: HTMLElement | null = null;
  const clearPadding = () => {
    if (paddedEl) {
      paddedEl.style.paddingBottom = '';
      paddedEl = null;
    }
  };

  const onKeyboardHeightChange = (rawEvent: Event) => {
    const event = rawEvent as NativeKeyboardHeightEvent;
    const active = document.activeElement as HTMLElement | null;
    const isField = !!active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);

    if (!event.visible || !isField) {
      clearPadding();
      return;
    }

    const scrollParent = findScrollParent(active!);
    if (paddedEl && paddedEl !== scrollParent) clearPadding();

    // Nothing resizes under adjustPan, so window.innerHeight is still the real, untouched,
    // full-page height — the keyboard covers everything below (innerHeight - keyboardHeight).
    const visibleBottom = window.innerHeight - event.keyboardHeight;
    const neededScroll = Math.max(0, active!.getBoundingClientRect().bottom - visibleBottom + FIELD_BOTTOM_MARGIN_PX);

    if (neededScroll <= 0) {
      clearPadding();
      return;
    }

    // Only pad if the document doesn't already have enough room below to scroll that far —
    // padding is purely a last resort for fields near the very end of the page, never a
    // blanket reservation.
    const maxScroll = scrollParent.scrollHeight - scrollParent.clientHeight - scrollParent.scrollTop;
    const deficit = Math.ceil(neededScroll - maxScroll);
    if (deficit > 0) {
      scrollParent.style.paddingBottom = `${deficit}px`;
      paddedEl = scrollParent;
    } else {
      clearPadding();
    }

    scrollParent.scrollTop += neededScroll;
  };

  window.addEventListener('nativeKeyboardHeightChange', onKeyboardHeightChange);
  return () => {
    window.removeEventListener('nativeKeyboardHeightChange', onKeyboardHeightChange);
    clearPadding();
  };
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PhotoViewer, ToastHost, ConfirmDialog],
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
