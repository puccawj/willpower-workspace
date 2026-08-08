import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  MeApiService,
  MyProfile,
  MyStudentApplication,
} from '../../../core/services/me-api.service';
import { UploadApiService } from '../../../core/services/upload-api.service';
import { ToastService } from '../../../core/services/toast.service';

function computeInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  general: 'General member',
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
  superadmin: 'Super admin',
};

@Component({
  selector: 'app-edit-profile',
  imports: [FormsModule],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
})
export class EditProfile {
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly profile = signal<MyProfile | null>(null);

  // Profile fields
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly nickname = signal('');
  readonly phoneNumber = signal('');
  readonly profileSaving = signal(false);
  readonly profileError = signal('');

  // Password fields
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly passwordSaving = signal(false);
  readonly passwordError = signal('');

  // Student application
  readonly application = signal<MyStudentApplication | null>(null);
  readonly appLineId = signal('');
  readonly appPhotoFile = signal<File | null>(null);
  readonly appSaving = signal(false);
  readonly appError = signal('');

  readonly canChangePassword = () => this.profile()?.registrationSource === 'self';
  readonly roleLabel = () => ROLE_LABELS[this.auth.currentUser()?.role ?? ''] ?? this.auth.currentUser()?.role ?? '';

  constructor() {
    this.meApi.getProfile().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.firstName.set(p.firstName);
        this.lastName.set(p.lastName);
        this.nickname.set(p.nickname ?? '');
        this.phoneNumber.set(p.phoneNumber ?? '');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.meApi.myStudentApplication().subscribe({
      next: (app) => {
        this.application.set(app);
        if (app) {
          this.appLineId.set(app.lineId ?? '');
        }
      },
    });
  }

  saveProfile(): void {
    this.profileError.set('');
    if (!this.firstName().trim() || !this.lastName().trim()) {
      this.profileError.set('First name and last name are required.');
      return;
    }

    this.profileSaving.set(true);
    this.meApi
      .updateProfile({
        firstName: this.firstName().trim(),
        lastName: this.lastName().trim(),
        nickname: this.nickname().trim(),
        phoneNumber: this.phoneNumber().trim(),
      })
      .subscribe({
        next: (p) => {
          this.profile.set(p);
          this.profileSaving.set(false);
          this.auth.updateUser({
            name: `${p.firstName} ${p.lastName}`.trim(),
            initials: computeInitials(p.firstName, p.lastName),
          });
          this.toast.show('Profile updated.', 'success');
        },
        error: (err) => {
          this.profileSaving.set(false);
          const message = err?.error?.message ?? 'Could not save your profile right now.';
          this.profileError.set(message);
          this.toast.show(message, 'error');
        },
      });
  }

  changePassword(): void {
    this.passwordError.set('');
    if (!this.currentPassword() || !this.newPassword()) {
      this.passwordError.set('Please fill in both password fields.');
      return;
    }
    if (this.newPassword().length < 8) {
      this.passwordError.set('New password must be at least 8 characters.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('New password and confirmation do not match.');
      return;
    }

    this.passwordSaving.set(true);
    this.meApi.changePassword({ currentPassword: this.currentPassword(), newPassword: this.newPassword() }).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.toast.show('Password changed.', 'success');
      },
      error: (err) => {
        this.passwordSaving.set(false);
        const message = err?.error?.message ?? 'Could not change your password right now.';
        this.passwordError.set(message);
        this.toast.show(message, 'error');
      },
    });
  }

  onAppPhotoFileSelected(input: HTMLInputElement): void {
    this.appPhotoFile.set(input.files?.[0] ?? null);
  }

  saveApplication(): void {
    this.appError.set('');

    this.appSaving.set(true);
    const photoFile = this.appPhotoFile();
    const photoUrl$: Observable<string | undefined> = photoFile ? this.uploads.uploadFile(photoFile) : of(undefined);
    photoUrl$
      .pipe(
        switchMap((photoUrl) =>
          this.meApi.updateStudentApplication({
            lineId: this.appLineId().trim(),
            photoUrl,
          }),
        ),
      )
      .subscribe({
        next: (app) => {
          this.application.set(app);
          this.appSaving.set(false);
          this.appPhotoFile.set(null);
          this.toast.show('Application updated.', 'success');
        },
        error: (err) => {
          this.appSaving.set(false);
          const message = err?.error?.message ?? 'Could not save your application right now.';
          this.appError.set(message);
          this.toast.show(message, 'error');
        },
      });
  }
}
