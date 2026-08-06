import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { AuthService } from '../../core/services/auth.service';
import { MeApiService } from '../../core/services/me-api.service';
import { PullToRefreshService } from '../../core/services/pull-to-refresh.service';
import { PushRegistrationService } from '../../core/services/push-registration.service';

const PUBLIC_SITE_URL = 'https://www.wpusa.online';

@Component({
  selector: 'app-profile',
  imports: [RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  protected readonly auth = inject(AuthService);
  protected readonly meApi = inject(MeApiService);
  private readonly router = inject(Router);
  private readonly pullToRefresh = inject(PullToRefreshService);
  private readonly pushRegistration = inject(PushRegistrationService);

  protected readonly appVersion = signal('');

  constructor() {
    this.meApi.loadAll();

    this.pullToRefresh.register(() => this.meApi.loadAll());
    inject(DestroyRef).onDestroy(() => this.pullToRefresh.clear());

    CapacitorApp.getInfo()
      .then((info) => this.appVersion.set(`v${info.version} (${info.build})`))
      .catch(() => this.appVersion.set(''));
  }

  openAbout(): void {
    void Browser.open({ url: `${PUBLIC_SITE_URL}/#/about` });
  }

  openTeam(): void {
    void Browser.open({ url: `${PUBLIC_SITE_URL}/#/team` });
  }

  openBranches(): void {
    void Browser.open({ url: `${PUBLIC_SITE_URL}/#/about#branches` });
  }

  openPrivacyPolicy(): void {
    void Browser.open({ url: `${PUBLIC_SITE_URL}/#/policy` });
  }

  logout(): void {
    void this.pushRegistration.unregister();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
