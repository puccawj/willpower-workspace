import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

/**
 * Native-plugin version of public-site's sso-buttons: Google blocks its web SDK inside an
 * embedded WebView (`disallowed_useragent`), so this uses @capgo/capacitor-social-login
 * instead, reusing the same googleClientId/facebookAppId already configured for the web apps.
 *
 * google and facebook are initialized via SEPARATE calls, not one combined call — the
 * plugin's native `initialize()` processes providers sequentially in the order given and
 * bails out of the whole call on the first error, so a problem in one provider's setup
 * silently prevents the other from ever being registered.
 */
@Component({
  selector: 'app-sso-buttons',
  imports: [],
  templateUrl: './sso-buttons.html',
  styleUrl: './sso-buttons.scss',
})
export class SsoButtons implements OnInit {
  private readonly auth = inject(AuthService);

  @Input() mode: 'login' | 'register' = 'login';
  @Output() readonly success = new EventEmitter<void>();
  @Output() readonly failure = new EventEmitter<string>();

  readonly googleConfigured = !!environment.googleClientId;
  readonly facebookConfigured = !!environment.facebookAppId;

  async ngOnInit(): Promise<void> {
    if (this.googleConfigured) {
      try {
        await SocialLogin.initialize({ google: { webClientId: environment.googleClientId, mode: 'online' } });
      } catch (err) {
        console.error('Google SocialLogin.initialize failed:', err);
      }
    }

    if (this.facebookConfigured) {
      try {
        await SocialLogin.initialize({
          facebook: { appId: environment.facebookAppId, clientToken: environment.facebookClientToken },
        });
      } catch (err) {
        console.error('Facebook SocialLogin.initialize failed:', err);
      }
    }
  }

  async continueWithGoogle(): Promise<void> {
    try {
      // No `scopes` here on purpose — Google's native SDK requires extra MainActivity
      // wiring to request scopes beyond the default ID token, which already carries
      // email/profile claims and is all the backend's /auth/google needs.
      const { result } = await SocialLogin.login({ provider: 'google', options: {} });
      const idToken = 'idToken' in result ? result.idToken : null;
      if (!idToken) {
        this.failure.emit('Google sign-in was cancelled.');
        return;
      }
      this.auth.loginWithGoogle(idToken, this.mode === 'register').subscribe((res) => {
        if (res.ok) this.success.emit();
        else this.failure.emit(res.message);
      });
    } catch (err) {
      this.failure.emit(errorMessage(err, 'Google sign-in was cancelled.'));
    }
  }

  async continueWithFacebook(): Promise<void> {
    try {
      const { result } = await SocialLogin.login({ provider: 'facebook', options: { permissions: ['email', 'public_profile'] } });
      const accessToken = result.accessToken?.token;
      if (!accessToken) {
        this.failure.emit('Facebook sign-in was cancelled.');
        return;
      }
      this.auth.loginWithFacebook(accessToken, this.mode === 'register').subscribe((res) => {
        if (res.ok) this.success.emit();
        else this.failure.emit(res.message);
      });
    } catch (err) {
      this.failure.emit(errorMessage(err, 'Facebook sign-in was cancelled.'));
    }
  }
}
