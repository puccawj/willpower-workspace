import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role } from '../models/admin.models';
import { RoleService } from './role.service';

const STORAGE_KEY = 'wp_admin_session';
const STAFF_ROLES: Role[] = ['superadmin', 'admin', 'instructor'];

interface Session {
  token: string;
  email: string;
  role: Role;
  name: string;
}

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: string; name: string };
}

type AuthOutcome = { ok: true } | { ok: false; message: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly session = signal<Session | null>(this.restoreSession());
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly currentEmail = computed(() => this.session()?.email ?? '');

  constructor(private readonly roleService: RoleService) {
    const session = this.session();
    if (session) this.roleService.setRole(session.role);
  }

  login(email: string, password: string): Observable<AuthOutcome> {
    return this.callAndPersist(`${environment.apiUrl}/auth/login`, { email, password }, 'Invalid email or password.');
  }

  /** allowCreate is always false here — admin/staff accounts must already exist (created via Manage User), SSO only logs in, never auto-creates one. */
  loginWithGoogle(idToken: string): Observable<AuthOutcome> {
    return this.callAndPersist(`${environment.apiUrl}/auth/google`, { idToken, allowCreate: false }, 'Google sign-in failed.');
  }

  loginWithFacebook(accessToken: string): Observable<AuthOutcome> {
    return this.callAndPersist(
      `${environment.apiUrl}/auth/facebook`,
      { accessToken, allowCreate: false },
      'Facebook sign-in failed.',
    );
  }

  logout(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  /**
   * The backend's /auth/* endpoints authenticate any active user regardless of role — a
   * student or general (public-site) account can pass valid credentials just fine. Reject
   * here, before persisting a session, so no non-staff role ever reaches the admin shell.
   */
  private callAndPersist(url: string, body: unknown, fallbackMessage: string): Observable<AuthOutcome> {
    return this.http.post<LoginResponse>(url, body).pipe(
      switchMap((res) =>
        STAFF_ROLES.includes(res.user.role as Role)
          ? of(res)
          : throwError(() => ({ error: { message: 'This account does not have access to the admin panel.' } })),
      ),
      tap((res) => {
        const session: Session = {
          token: res.accessToken,
          email: res.user.email,
          role: res.user.role as Role,
          name: res.user.name,
        };
        this.session.set(session);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        this.roleService.setRole(session.role);
      }),
      map(() => ({ ok: true as const })),
      catchError((err) => of({ ok: false as const, message: err?.error?.message ?? fallbackMessage })),
    );
  }

  /**
   * Re-validates the role on every restore, not just at login time — a session persisted
   * before this staff-role check existed (or a role changed/revoked server-side since) would
   * otherwise sit trusted in localStorage forever, leaving the app stuck in a redirect loop
   * between authGuard (sees a non-null session, lets it through) and roleAccessGuard
   * (rejects the role, bounces to /dashboard, which re-triggers the same rejection).
   */
  private restoreSession(): Session | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Session;
      if (!STAFF_ROLES.includes(parsed.role)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
