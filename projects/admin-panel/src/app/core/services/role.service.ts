import { Injectable, computed, signal } from '@angular/core';
import { Role } from '../models/admin.models';

export const CURRENT_INSTRUCTOR_NAME = 'Ajahn Suriya';

@Injectable({ providedIn: 'root' })
export class RoleService {
  readonly role = signal<Role>('superadmin');
  readonly isSuper = computed(() => this.role() === 'superadmin');
  readonly isInstructor = computed(() => this.role() === 'instructor');
  readonly instructorName = CURRENT_INSTRUCTOR_NAME;

  readonly scopeLabel = computed(() => {
    switch (this.role()) {
      case 'superadmin':
        return 'All branches';
      case 'admin':
        return 'USA · Canada';
      case 'instructor':
        return this.instructorName;
    }
  });

  readonly userInitials = computed(() => {
    switch (this.role()) {
      case 'superadmin':
        return 'SA';
      case 'admin':
        return 'AD';
      case 'instructor':
        return 'AS';
    }
  });

  setRole(role: Role): void {
    this.role.set(role);
  }
}
