import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { RoleService } from '../../core/services/role.service';
import { NotificationService } from '../../core/services/notification.service';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-topbar',
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly roleService = inject(RoleService);
  readonly notifications = inject(NotificationService);
  readonly layout = inject(LayoutService);
  readonly bellOpen = signal(false);

  toggleBell(): void {
    this.bellOpen.update((v) => !v);
    if (this.bellOpen()) this.notifications.markAllRead();
  }

  timeAgo(date: Date): string {
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    return `${hours}h ago`;
  }

  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.deepestChild(this.route).snapshot.data),
    ),
    { initialValue: this.deepestChild(this.route).snapshot.data },
  );

  readonly title = computed(() => (this.routeData()['title'] as string) ?? '');
  readonly subtitle = computed(() => (this.routeData()['subtitle'] as string) ?? '');

  private deepestChild(route: ActivatedRoute): ActivatedRoute {
    let r = route;
    while (r.firstChild) r = r.firstChild;
    return r;
  }
}
