import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { MeApiService, MyProfile, MyStudentApplication } from '../../../core/services/me-api.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-apply-student',
  imports: [FormsModule, RouterLink],
  templateUrl: './apply-student.html',
  styleUrl: './apply-student.scss',
})
export class ApplyStudent {
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);

  readonly isGeneral = () => this.auth.currentUser()?.role === 'general';
  readonly isStudent = () => this.auth.currentUser()?.role === 'student';

  readonly loading = signal(true);
  readonly profile = signal<MyProfile | null>(null);
  readonly application = signal<MyStudentApplication | null>(null);
  readonly submitting = signal(false);
  readonly error = signal('');

  readonly lineId = signal('');
  readonly photoFile = signal<File | null>(null);

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

  onPhotoFileSelected(input: HTMLInputElement): void {
    this.photoFile.set(input.files?.[0] ?? null);
  }

  submit(): void {
    this.error.set('');
    const p = this.profile();
    if (!p || !p.firstName.trim() || !p.lastName.trim() || !(p.nickname ?? '').trim()) {
      this.error.set('Please fill in your first name, last name, and nickname in Edit profile first.');
      return;
    }

    this.submitting.set(true);
    const photoFile = this.photoFile();
    const photoUrl$: Observable<string | undefined> = photoFile ? this.uploads.uploadFile(photoFile) : of(undefined);
    photoUrl$
      .pipe(
        switchMap((photoUrl) =>
          this.meApi.applyForStudent({
            email: p.email,
            firstName: p.firstName,
            lastName: p.lastName,
            nickname: p.nickname ?? '',
            phone: p.phoneNumber ?? undefined,
            lineId: this.lineId().trim() || undefined,
            photoUrl,
          }),
        ),
      )
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
