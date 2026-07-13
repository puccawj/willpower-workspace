import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { RoleService } from '../../core/services/role.service';
import { LayoutService } from '../../core/services/layout.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/admin.models';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  allow: Role[];
}

interface NavGroup {
  header: string;
  items: NavItem[];
}

const ALL_STAFF: Role[] = ['superadmin', 'admin'];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly router = inject(Router);
  readonly roleService = inject(RoleService);
  readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);

  private readonly groups: NavGroup[] = [
    { header: 'Overview', items: [{ path: 'dashboard', label: 'Dashboard', icon: '◆', allow: ALL_STAFF }] },
    {
      header: 'Events',
      items: [
        { path: 'events', label: 'Manage Events', icon: '▤', allow: ALL_STAFF },
        { path: 'rsvp', label: 'RSVP & Attendance', icon: '✓', allow: ALL_STAFF },
      ],
    },
    { header: 'Giving', items: [{ path: 'donations', label: 'Manage Donation', icon: '❖', allow: ALL_STAFF }] },
    {
      header: 'People',
      items: [
        { path: 'users', label: 'Manage User', icon: '◐', allow: ALL_STAFF },
        { path: 'branches', label: 'Manage Branch', icon: '⬢', allow: ['superadmin'] },
      ],
    },
    {
      header: 'Learning',
      items: [
        { path: 'courses', label: 'Manage Course', icon: '▣', allow: ['superadmin', 'admin', 'instructor'] },
        { path: 'schedule', label: 'Class Schedule', icon: '▦', allow: ['superadmin', 'admin', 'instructor'] },
        { path: 'enrollment', label: 'Enrollment & Attendance', icon: '☑', allow: ['superadmin', 'admin', 'instructor'] },
      ],
    },
    {
      header: 'Certificates',
      items: [
        { path: 'certificates', label: 'Certificate Management', icon: '◈', allow: ALL_STAFF },
        { path: 'templates', label: 'Certificate Templates', icon: '▧', allow: ['superadmin'] },
      ],
    },
    { header: 'Site', items: [{ path: 'team', label: 'Team Management', icon: '◍', allow: ALL_STAFF }] },
    { header: 'Insights', items: [{ path: 'reports', label: 'Reports', icon: '▥', allow: ALL_STAFF }] },
  ];

  readonly visibleGroups = computed(() => {
    const role = this.roleService.role();
    return this.groups
      .map((g) => ({ ...g, items: g.items.filter((it) => it.allow.includes(role)) }))
      .filter((g) => g.items.length > 0);
  });

  setRole(role: Role): void {
    this.roleService.setRole(role);
    const current = this.router.url.split('/').pop() ?? '';
    const stillVisible = this.groups.some((g) => g.items.some((it) => it.path === current && it.allow.includes(role)));
    if (!stillVisible) {
      this.router.navigate([role === 'instructor' ? '/courses' : '/dashboard']);
    }
  }

  onNavClick(): void {
    this.layout.closeMobileMenu();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
