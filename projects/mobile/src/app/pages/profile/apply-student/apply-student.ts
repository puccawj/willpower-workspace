import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { MeApiService, MyStudentApplication } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-apply-student',
  imports: [FormsModule, BackButton],
  templateUrl: './apply-student.html',
  styleUrl: './apply-student.scss',
})
export class ApplyStudent {
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);

  readonly isGeneral = () => this.auth.currentUser()?.role === 'general';
  readonly isStudent = () => this.auth.currentUser()?.role === 'student';

  readonly loading = signal(true);
  readonly application = signal<MyStudentApplication | null>(null);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);

  readonly email = signal(this.auth.currentUser()?.email ?? '');
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly nickname = signal('');
  readonly phone = signal('');
  readonly lineId = signal('');

  constructor() {
    this.meApi.myStudentApplication().subscribe({
      next: (app) => {
        this.application.set(app);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    this.error.set('');
    if (!this.firstName().trim() || !this.lastName().trim() || !this.nickname().trim() || !this.email().trim()) {
      this.error.set('Please fill in Email, Full name, Last name, and Nickname.');
      return;
    }

    this.submitting.set(true);
    this.meApi
      .applyForStudent({
        email: this.email().trim(),
        firstName: this.firstName().trim(),
        lastName: this.lastName().trim(),
        nickname: this.nickname().trim(),
        phone: this.phone().trim() || undefined,
        lineId: this.lineId().trim() || undefined,
      })
      .subscribe({
        next: (app) => {
          this.application.set(app);
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.message ?? 'Could not submit your application right now.');
        },
      });
  }
}
