import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Registers this device for native push notifications (Android/iOS only — no-ops on
 * web, where the in-app bell + polling already covers notifications). Call `init()`
 * once after login, from a screen the user only reaches with a valid session.
 *
 * Uses @capacitor-firebase/messaging (not the plain @capacitor/push-notifications
 * plugin) specifically so iOS yields an FCM token like Android does — the backend's
 * Firebase Admin SDK (`sendEachForMulticast`) only knows how to target FCM tokens,
 * and the plain plugin gives iOS a raw APNs token it can't send to directly.
 */
@Injectable({ providedIn: 'root' })
export class PushRegistrationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private started = false;
  private currentToken: string | null = null;

  async init(): Promise<void> {
    if (this.started || !Capacitor.isNativePlatform()) return;
    this.started = true;

    const permission = await FirebaseMessaging.checkPermissions();
    let receive = permission.receive;
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      receive = (await FirebaseMessaging.requestPermissions()).receive;
    }
    if (receive !== 'granted') return;

    await FirebaseMessaging.addListener('tokenReceived', (event) => {
      this.currentToken = event.token;
      void this.sendTokenToServer(event.token);
    });

    // Tapped a push while the app was backgrounded/closed — take them to the notification list.
    await FirebaseMessaging.addListener('notificationActionPerformed', () => {
      void this.router.navigateByUrl('/notifications');
    });

    try {
      const { token } = await FirebaseMessaging.getToken();
      this.currentToken = token;
      void this.sendTokenToServer(token);
    } catch (err) {
      console.error('Push registration failed:', err);
    }
  }

  async unregister(): Promise<void> {
    if (!this.currentToken) return;
    const token = this.currentToken;
    this.currentToken = null;
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/me/devices/${encodeURIComponent(token)}`));
    } catch {
      // Best-effort — logging out shouldn't fail because the unregister call failed.
    }
  }

  private async sendTokenToServer(pushToken: string): Promise<void> {
    if (!this.auth.isLoggedIn()) return;
    this.http
      .post(`${environment.apiUrl}/me/devices`, {
        platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
        pushToken,
      })
      .subscribe({ error: (err) => console.error('Failed to register device for push:', err) });
  }
}
