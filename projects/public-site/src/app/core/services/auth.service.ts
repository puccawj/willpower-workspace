import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StudentUser } from '../models/student.models';

const STORAGE_KEY = 'willpower.student-session';

interface Session {
  token: string;
  user: StudentUser;
}

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: string; name: string };
}

type AuthOutcome = { ok: true } | { ok: false; message: string };

function toStudentUser(user: LoginResponse['user']): StudentUser {
  const name = user.name || user.email.split('@')[0];
  return {
    name,
    email: user.email,
    role: user.role,
    initials: name
      .split(' ')
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  };
}

function readStoredSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly session = signal<Session | null>(readStoredSession());
  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);

  login(email: string, password: string): Observable<AuthOutcome> {
    return this.callAndPersist(`${environment.apiUrl}/auth/login`, { email, password }, 'Invalid email or password.');
  }

  register(firstName: string, lastName: string, email: string, password: string): Observable<AuthOutcome> {
    return this.callAndPersist(
      `${environment.apiUrl}/auth/register`,
      { firstName, lastName, email, password },
      'Could not create your account.',
    );
  }

  loginWithGoogle(idToken: string, allowCreate: boolean): Observable<AuthOutcome> {
    return this.callAndPersist(`${environment.apiUrl}/auth/google`, { idToken, allowCreate }, 'Google sign-in failed.');
  }

  loginWithFacebook(accessToken: string, allowCreate: boolean): Observable<AuthOutcome> {
    return this.callAndPersist(
      `${environment.apiUrl}/auth/facebook`,
      { accessToken, allowCreate },
      'Facebook sign-in failed.',
    );
  }

  logout(): void {
    this.session.set(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  private callAndPersist(url: string, body: unknown, fallbackMessage: string): Observable<AuthOutcome> {
    return this.http.post<LoginResponse>(url, body).pipe(
      tap((res) => {
        const session: Session = { token: res.accessToken, user: toStudentUser(res.user) };
        this.session.set(session);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        }
      }),
      map(() => ({ ok: true as const })),
      catchError((err) => of({ ok: false as const, message: err?.error?.message ?? fallbackMessage })),
    );
  }
}
