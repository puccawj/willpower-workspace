import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);

  submit(): void {
    this.error.set('');

    if (!this.email().trim() || !this.password()) {
      this.error.set('Please enter both email and password.');
      return;
    }

    this.loading.set(true);

    this.auth.login(this.email(), this.password()).subscribe((result) => {
      this.loading.set(false);

      if (!result.ok) {
        this.error.set(result.message);
        return;
      }

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
      this.router.navigateByUrl(returnUrl);
    });
  }

  fillDemo(role: 'superadmin' | 'admin' | 'instructor'): void {
    const map = {
      superadmin: { email: 'superadmin@willpower.org', password: 'superadmin123' },
      admin: { email: 'admin@willpower.org', password: 'admin123' },
      instructor: { email: 'instructor@willpower.org', password: 'instructor123' },
    };
    this.email.set(map[role].email);
    this.password.set(map[role].password);
  }
}
