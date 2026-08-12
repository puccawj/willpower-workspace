import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MeApiService, MyProfile, MyStudentApplication } from '../../../core/services/me-api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-apply-student',
  imports: [RouterLink],
  templateUrl: './apply-student.html',
  styleUrl: './apply-student.scss',
})
export class ApplyStudent {
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);
  private readonly toast = inject(ToastService);

  readonly isGeneral = () => this.auth.currentUser()?.role === 'general';
  readonly isStudent = () => this.auth.currentUser()?.role === 'student';

  readonly loading = signal(true);
  readonly profile = signal<MyProfile | null>(null);
  readonly application = signal<MyStudentApplication | null>(null);
  readonly submitting = signal(false);
  readonly error = signal('');

  constructor() {
    Promise.all([
      new Promise<void>((resolve) => {
        this.meApi.getProfile().subscribe({
          next: (p) => {
            this.profile.set(p);
            resolve();
          },
          error: () => resolve(),
        });
      }),
      new Promise<void>((resolve) => {
        this.meApi.myStudentApplication().subscribe({
          next: (app) => {
            this.application.set(app);
            resolve();
          },
          error: () => resolve(),
        });
      }),
    ]).then(() => this.loading.set(false));
  }

  submit(): void {
    this.error.set('');
    const p = this.profile();
    if (!p || !p.firstName.trim() || !p.lastName.trim() || !(p.nickname ?? '').trim()) {
      this.error.set('Please fill in your first name, last name, and nickname in Edit profile first.');
      return;
    }

    this.submitting.set(true);
    this.meApi
      .applyForStudent({
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        nickname: p.nickname ?? '',
        phone: p.phoneNumber ?? undefined,
        lineId: p.lineId ?? undefined,
        photoUrl: p.photoUrl ?? undefined,
      })
      .subscribe({
        next: (app) => {
          this.application.set(app);
          this.submitting.set(false);
          this.toast.show('Application submitted — an admin will review it shortly.', 'success');
        },
        error: (err) => {
          this.submitting.set(false);
          const message = err?.error?.message ?? 'Could not submit your application right now.';
          this.error.set(message);
          this.toast.show(message, 'error');
        },
      });
  }
}
