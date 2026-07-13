import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role } from '../models/admin.models';
import { RoleService } from './role.service';

const STORAGE_KEY = 'wp_admin_session';

interface Session {
  token: string;
  email: string;
  role: Role;
  name: string;
}

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: Role; name: string };
}

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

  login(email: string, password: string): Observable<{ ok: true } | { ok: false; message: string }> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        const session: Session = { token: res.accessToken, email: res.user.email, role: res.user.role, name: res.user.name };
        this.session.set(session);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        this.roleService.setRole(session.role);
      }),
      map(() => ({ ok: true as const })),
      catchError((err) => of({ ok: false as const, message: err?.error?.message ?? 'Invalid email or password.' })),
    );
  }

  logout(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  private restoreSession(): Session | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
