import { Injectable, computed, signal } from '@angular/core';
import { Role } from '../models/admin.models';

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  readonly role = signal<Role>('superadmin');
  /** The logged-in user's real name — set by AuthService alongside the role, since RoleService
   * can't inject AuthService itself without a circular dependency (AuthService already injects
   * RoleService to keep it in sync on login/restore). */
  readonly name = signal('');
  readonly isSuper = computed(() => this.role() === 'superadmin');
  readonly isInstructor = computed(() => this.role() === 'instructor');

  readonly scopeLabel = computed(() => {
    switch (this.role()) {
      case 'superadmin':
        return 'All branches';
      case 'admin':
        return 'USA · Canada';
      case 'instructor':
        return this.name() || 'Instructor';
    }
  });

  readonly userInitials = computed(() => {
    switch (this.role()) {
      case 'superadmin':
        return 'SA';
      case 'admin':
        return 'AD';
      case 'instructor':
        return this.name() ? initialsFrom(this.name()) : 'IN';
    }
  });

  setRole(role: Role, name = ''): void {
    this.role.set(role);
    this.name.set(name);
  }
}
