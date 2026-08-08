import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import {
  MeApiService,
  MyProfile,
  MyStudentApplication,
} from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

function computeInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

@Component({
  selector: 'app-edit-profile',
  imports: [FormsModule, BackButton],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
})
export class EditProfile {
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);

  readonly loading = signal(true);
  readonly profile = signal<MyProfile | null>(null);

  // Profile fields
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly nickname = signal('');
  readonly phoneNumber = signal('');
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

  // Student application
  readonly application = signal<MyStudentApplication | null>(null);
  readonly appFirstName = signal('');
  readonly appLastName = signal('');
  readonly appNickname = signal('');
  readonly appPhone = signal('');
  readonly appLineId = signal('');
  readonly appSaving = signal(false);
  readonly appSaved = signal(false);
  readonly appError = signal('');

  readonly canChangePassword = () => this.profile()?.registrationSource === 'self';

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
          this.appFirstName.set(app.firstName);
          this.appLastName.set(app.lastName);
          this.appNickname.set(app.nickname);
          this.appPhone.set(app.phone ?? '');
          this.appLineId.set(app.lineId ?? '');
        }
      },
    });
  }

  saveProfile(): void {
    this.profileError.set('');
    this.profileSaved.set(false);
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
          this.profileSaved.set(true);
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

  saveApplication(): void {
    this.appError.set('');
    this.appSaved.set(false);
    if (!this.appFirstName().trim() || !this.appLastName().trim() || !this.appNickname().trim()) {
      this.appError.set('First name, last name, and nickname are required.');
      return;
    }

    this.appSaving.set(true);
    this.meApi
      .updateStudentApplication({
        firstName: this.appFirstName().trim(),
        lastName: this.appLastName().trim(),
        nickname: this.appNickname().trim(),
        phone: this.appPhone().trim(),
        lineId: this.appLineId().trim(),
      })
      .subscribe({
        next: (app) => {
          this.application.set(app);
          this.appSaving.set(false);
          this.appSaved.set(true);
        },
        error: (err) => {
          this.appSaving.set(false);
          this.appError.set(err?.error?.message ?? 'Could not save your application right now.');
        },
      });
  }
}
