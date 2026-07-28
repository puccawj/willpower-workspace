import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { interval } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationApiService } from '../../core/services/notification-api.service';

const POLL_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationApi = inject(NotificationApiService);

  readonly menuOpen = signal(false);
  readonly notifOpen = signal(false);
  readonly notifications = this.notificationApi.notifications;
  readonly unreadCount = this.notificationApi.unreadCount;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) this.notificationApi.loadUnreadCount().subscribe();
    });

    const sub = interval(POLL_INTERVAL_MS).subscribe(() => {
      if (this.auth.isLoggedIn()) this.notificationApi.loadUnreadCount().subscribe();
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleNotifications(): void {
    const next = !this.notifOpen();
    this.notifOpen.set(next);
    if (next) this.notificationApi.load().subscribe();
  }

  markRead(id: string): void {
    this.notificationApi.markRead(id).subscribe();
  }

  markAllRead(): void {
    this.notificationApi.markAllRead().subscribe();
  }

  deleteNotification(id: string, event: Event): void {
    event.stopPropagation();
    this.notificationApi.delete(id).subscribe();
  }

  logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.router.navigate(['/']);
  }
}
