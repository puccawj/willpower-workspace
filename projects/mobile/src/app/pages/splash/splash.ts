import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from '../../core/services/auth.service';
import { SecurityGateService } from '../../core/services/security-gate.service';

const ONBOARDED_KEY = 'willpower.onboarded';

@Component({
  selector: 'app-splash',
  imports: [],
  templateUrl: './splash.html',
  styleUrl: './splash.scss',
})
export class Splash {
  private readonly auth = inject(AuthService);
  private readonly gate = inject(SecurityGateService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    // AuthService.init() (a provideAppInitializer) has already resolved by the time any
    // route activates, so isLoggedIn() below is never a stale/transient false.
    if (this.auth.isLoggedIn()) {
      if (this.gate.isNative) {
        if (await this.gate.isPinConfigured()) {
          this.router.navigateByUrl('/security/unlock', { replaceUrl: true });
        } else {
          // PIN setup was skipped (or, defensively, never completed) — per the confirmed
          // decision, cold start always forces a fresh full login in that case rather than
          // silently trusting a cached session with no re-entry gate at all.
          this.auth.logout();
          this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      } else {
        this.router.navigateByUrl('/home', { replaceUrl: true });
      }
      return;
    }

    const { value } = await Preferences.get({ key: ONBOARDED_KEY });
    this.router.navigateByUrl(value ? '/login' : '/introduction', { replaceUrl: true });
  }
}
