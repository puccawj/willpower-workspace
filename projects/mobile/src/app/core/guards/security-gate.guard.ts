import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SecurityGateService } from '../services/security-gate.service';

export const securityGateGuard: CanActivateFn = () => {
  const gate = inject(SecurityGateService);
  const router = inject(Router);
  return gate.unlocked() ? true : router.createUrlTree(['/security/unlock']);
};
