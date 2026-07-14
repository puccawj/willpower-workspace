import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

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

/**
 * Staff/admin SSO — always logs in, never registers. Admin accounts must already exist
 * (created via Manage User); an SSO email with no matching existing account is rejected
 * by the backend rather than silently creating a new staff account.
 */
@Component({
  selector: 'app-sso-buttons',
  imports: [],
  templateUrl: './sso-buttons.html',
  styleUrl: './sso-buttons.scss',
})
export class SsoButtons implements OnInit {
  private readonly auth = inject(AuthService);

  @ViewChild('googleBtn') googleBtnRef?: ElementRef<HTMLDivElement>;
  @Output() readonly success = new EventEmitter<void>();
  @Output() readonly failure = new EventEmitter<string>();

  readonly googleConfigured = !!environment.googleClientId;
  readonly facebookConfigured = !!environment.facebookAppId;

  async ngOnInit(): Promise<void> {
    if (this.googleConfigured) {
      try {
        await loadScript('https://accounts.google.com/gsi/client');
        this.initGoogle();
      } catch {
        this.failure.emit('Could not load Google sign-in right now.');
      }
    }

    if (this.facebookConfigured) {
      try {
        await loadScript('https://connect.facebook.net/en_US/sdk.js');
        (window as any).FB?.init({ appId: environment.facebookAppId, xfbml: false, version: 'v19.0' });
      } catch {
        this.failure.emit('Could not load Facebook sign-in right now.');
      }
    }
  }

  private initGoogle(): void {
    const google = (window as any).google;
    if (!google?.accounts?.id || !this.googleBtnRef) return;

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: { credential: string }) => this.handleGoogleCredential(response.credential),
    });
    google.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
      type: 'icon',
      shape: 'circle',
      size: 'large',
    });
  }

  private handleGoogleCredential(idToken: string): void {
    this.auth.loginWithGoogle(idToken).subscribe((result) => {
      if (result.ok) this.success.emit();
      else this.failure.emit(result.message);
    });
  }

  continueWithFacebook(): void {
    const FB = (window as any).FB;
    if (!FB) {
      this.failure.emit('Facebook sign-in is still loading — please try again in a moment.');
      return;
    }

    FB.login(
      (response: any) => {
        if (response?.authResponse?.accessToken) {
          this.auth.loginWithFacebook(response.authResponse.accessToken).subscribe((result) => {
            if (result.ok) this.success.emit();
            else this.failure.emit(result.message);
          });
        } else {
          this.failure.emit('Facebook sign-in was cancelled.');
        }
      },
      { scope: 'email' },
    );
  }
}
