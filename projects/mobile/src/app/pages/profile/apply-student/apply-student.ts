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
  readonly isEligible = () => this.isGeneral() || this.isStudent();

  readonly loading = signal(true);
  readonly profile = signal<MyProfile | null>(null);
  readonly application = signal<MyStudentApplication | null>(null);
  readonly branches = signal<PublicBranch[]>([]);
  readonly selectedBranchIds = signal<string[]>([]);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);

  /** Branches the account isn't registered at yet — a student adding a branch must only be
   * offered ones they don't already belong to; a general account (no branches yet) sees all. */
  readonly availableBranches = computed(() => {
    const registeredIds = new Set((this.profile()?.branches ?? []).map((b) => b.branchId));
    return this.branches().filter((b) => !registeredIds.has(b.id));
  });

  /** Show the apply form again once the latest application has no branch still awaiting a
   * decision — either there's never been one, or every branch on it was approved/rejected.
   * A student adding another branch always starts from this state, since by definition their
   * previous application was already decided (that's how they became a student). */
  readonly canApply = computed(() => {
    const app = this.application();
    return !app || !app.branches.some((b) => b.status === 'pending');
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
