import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SsoButtons } from '../../shared/sso-buttons/sso-buttons';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, SsoButtons],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly loading = signal(false);

  submit(): void {
    this.error.set('');

    if (!this.firstName().trim() || !this.lastName().trim() || !this.email().trim()) {
      this.error.set('Please fill in your name and email.');
      return;
    }
    if (this.password().length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }

    this.loading.set(true);
    this.auth.register(this.firstName(), this.lastName(), this.email(), this.password()).subscribe((result) => {
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
