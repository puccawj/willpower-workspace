import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MeApiService, MyProfile, MyStudentApplication } from '../../../core/services/me-api.service';
import { BranchApiService, PublicBranch } from '../../../core/services/branch-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-apply-student',
  imports: [BackButton, RouterLink],
  templateUrl: './apply-student.html',
  styleUrl: './apply-student.scss',
})
export class ApplyStudent {
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);
  private readonly branchApi = inject(BranchApiService);

  readonly isGeneral = () => this.auth.currentUser()?.role === 'general';
  readonly isStudent = () => this.auth.currentUser()?.role === 'student';

  readonly loading = signal(true);
  readonly profile = signal<MyProfile | null>(null);
  readonly application = signal<MyStudentApplication | null>(null);
  readonly branches = signal<PublicBranch[]>([]);
  readonly selectedBranchIds = signal<string[]>([]);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);

  /** Show the apply form again once every branch on the latest application has a decision —
   * either there's never been one, or every branch was rejected. */
  readonly canApply = computed(() => {
    const app = this.application();
    return !app || app.branches.every((b) => b.status === 'rejected');
  });

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
      new Promise<void>((resolve) => {
        this.branchApi.load().subscribe({
          next: (branches) => {
            this.branches.set(branches);
            resolve();
          },
          error: () => resolve(),
        });
      }),
    ]).then(() => this.loading.set(false));
  }

  toggleBranch(branchId: string, checked: boolean): void {
    this.selectedBranchIds.update((ids) => (checked ? [...ids, branchId] : ids.filter((id) => id !== branchId)));
  }

  isBranchSelected(branchId: string): boolean {
    return this.selectedBranchIds().includes(branchId);
  }

  submit(): void {
    this.error.set('');
    const p = this.profile();
    if (!p || !p.firstName.trim() || !p.lastName.trim() || !(p.nickname ?? '').trim()) {
      this.error.set('Please fill in your first name, last name, and nickname in Edit profile first.');
      return;
    }
    if (!this.selectedBranchIds().length) {
      this.error.set('Please select at least one branch you want to attend.');
      return;
    }

    this.submitting.set(true);
    this.meApi
      .applyForStudent({
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        nickname: p.nickname ?? '',
        branchIds: this.selectedBranchIds(),
        phone: p.phoneNumber ?? undefined,
        lineId: p.lineId ?? undefined,
        photoUrl: p.photoUrl ?? undefined,
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
