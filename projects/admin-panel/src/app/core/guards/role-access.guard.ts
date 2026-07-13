import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoleService } from '../services/role.service';
import { Role } from '../models/admin.models';

/**
 * Reads `data.allow: Role[]` off the matched route. Instructor accounts are
 * scoped to Manage Course / Class Schedule / Enrollment & Attendance only
 * (per the permission matrix in Willpower-Institute-Requirement-Summary-TH.md);
 * everything else is superadmin/admin only.
 */
export const roleAccessGuard: CanActivateFn = (route) => {
  const roleService = inject(RoleService);
  const router = inject(Router);
  const allow = route.data['allow'] as Role[] | undefined;

  if (!allow || allow.includes(roleService.role())) return true;

  return router.createUrlTree([roleService.isInstructor() ? '/courses' : '/dashboard']);
};
