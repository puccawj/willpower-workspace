import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { environment } from '../../../environments/environment';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

@Component({
  selector: 'app-turnstile-widget',
  imports: [],
  templateUrl: './turnstile-widget.html',
  styleUrl: './turnstile-widget.scss',
})
export class TurnstileWidget implements OnInit {
  @ViewChild('container') containerRef?: ElementRef<HTMLDivElement>;
  @Output() readonly tokenChange = new EventEmitter<string>();

  readonly configured = !!environment.turnstileSiteKey;
  private widgetId: string | null = null;

  async ngOnInit(): Promise<void> {
    if (!this.configured) return;
    try {
      await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js');
      this.render();
    } catch {
      // Verification simply won't be available — the backend only requires a token
      // when TURNSTILE_SECRET_KEY is configured server-side.
    }
  }

  reset(): void {
    const turnstile = (window as any).turnstile;
    if (turnstile && this.widgetId) turnstile.reset(this.widgetId);
  }

  private render(): void {
    const turnstile = (window as any).turnstile;
    if (!turnstile || !this.containerRef) return;

    this.widgetId = turnstile.render(this.containerRef.nativeElement, {
      sitekey: environment.turnstileSiteKey,
      size: 'flexible',
      callback: (token: string) => this.tokenChange.emit(token),
      'expired-callback': () => this.tokenChange.emit(''),
      'error-callback': () => this.tokenChange.emit(''),
    });
  }
}
