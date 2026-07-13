import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SsoButtons } from '../../shared/sso-buttons/sso-buttons';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, SsoButtons],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
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

      this.goToDestination();
    });
  }

  onSsoSuccess(): void {
    this.goToDestination();
  }

  onSsoFailure(message: string): void {
    this.error.set(message);
  }

  private goToDestination(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/my';
    this.router.navigateByUrl(returnUrl);
  }
}
