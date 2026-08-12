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
import { BackButton } from '../../../shared/back-button/back-button';

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
  imports: [FormsModule, BackButton],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
})
export class EditProfile {
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);
  private readonly uploads = inject(UploadApiService);

  readonly loading = signal(true);
  readonly profile = signal<MyProfile | null>(null);

  // Profile fields — nickname, phone, LINE ID, and photo all live on the account
  // profile itself, so they stay editable here regardless of student application
  // status instead of getting locked once an application is approved.
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly nickname = signal('');
  readonly phoneNumber = signal('');
  readonly lineId = signal('');
  readonly photoFile = signal<File | null>(null);
  readonly profileSaving = signal(false);
  readonly profileSaved = signal(false);
  readonly profileError = signal('');

  // Password fields
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly passwordSaving = signal(false);
  readonly passwordSaved = signal(false);
  readonly passwordError = signal('');

  // Student application — status only; its personal-info fields all come from the
  // profile above now, nothing left here to edit.
  readonly application = signal<MyStudentApplication | null>(null);

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
        this.lineId.set(p.lineId ?? '');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.meApi.myStudentApplication().subscribe({
      next: (app) => this.application.set(app),
    });
  }

  onPhotoFileSelected(input: HTMLInputElement): void {
    this.photoFile.set(input.files?.[0] ?? null);
  }

  saveProfile(): void {
    this.profileError.set('');
    this.profileSaved.set(false);
    if (!this.firstName().trim() || !this.lastName().trim()) {
      this.profileError.set('First name and last name are required.');
      return;
    }

    this.profileSaving.set(true);
    const photoFile = this.photoFile();
    const photoUrl$: Observable<string | undefined> = photoFile ? this.uploads.uploadFile(photoFile) : of(undefined);
    photoUrl$
      .pipe(
        switchMap((photoUrl) =>
          this.meApi.updateProfile({
            firstName: this.firstName().trim(),
            lastName: this.lastName().trim(),
            nickname: this.nickname().trim(),
            phoneNumber: this.phoneNumber().trim(),
            lineId: this.lineId().trim(),
            photoUrl,
          }),
        ),
      )
      .subscribe({
        next: (p) => {
          this.profile.set(p);
          this.profileSaving.set(false);
          this.profileSaved.set(true);
          this.photoFile.set(null);
          this.auth.updateUser({
            name: `${p.firstName} ${p.lastName}`.trim(),
            initials: computeInitials(p.firstName, p.lastName),
          });
        },
        error: (err) => {
          this.profileSaving.set(false);
          this.profileError.set(err?.error?.message ?? 'Could not save your profile right now.');
        },
      });
  }

  changePassword(): void {
    this.passwordError.set('');
    this.passwordSaved.set(false);
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
        this.passwordSaved.set(true);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
      },
      error: (err) => {
        this.passwordSaving.set(false);
        this.passwordError.set(err?.error?.message ?? 'Could not change your password right now.');
      },
    });
  }
}
