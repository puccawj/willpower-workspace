import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BranchApiService } from '../../core/services/branch-api.service';
import { BroadcastApiService } from '../../core/services/broadcast-api.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-broadcast',
  imports: [FormsModule, DatePipe],
  templateUrl: './broadcast.html',
  styleUrl: './broadcast.scss',
})
export class Broadcast {
  private readonly api = inject(BroadcastApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly roleService = inject(RoleService);
  private readonly toast = inject(ToastService);

  readonly isSuper = this.roleService.isSuper;
  readonly branches = this.branchApi.branches;
  readonly history = this.api.history;
  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly title = signal('');
  readonly message = signal('');
  readonly scope = signal<'all' | 'branch'>('branch');
  readonly branchId = signal('');
  readonly studentsOnly = signal(false);
  readonly sending = signal(false);

  constructor() {
    this.branchApi.load().subscribe();
    this.api.loadHistory().subscribe();
  }

  send(): void {
    const title = this.title().trim();
    const message = this.message().trim();
    if (!title || !message) {
      this.toast.show('Please fill in a title and message.', 'error');
      return;
    }
    if (this.scope() === 'branch' && !this.branchId()) {
      this.toast.show('Please choose a branch.', 'error');
      return;
    }

    this.sending.set(true);
    this.api
      .send({
        title,
        message,
        scope: this.scope(),
        branchId: this.scope() === 'branch' ? this.branchId() : undefined,
        studentsOnly: this.studentsOnly(),
      })
      .subscribe({
        next: (res) => {
          this.sending.set(false);
          this.toast.show(`Sent to ${res.recipientCount} recipient(s).`, 'success');
          this.title.set('');
          this.message.set('');
          this.studentsOnly.set(false);
        },
        error: (err) => {
          this.sending.set(false);
          this.toast.show(err?.error?.message ?? 'Failed to send broadcast.', 'error');
        },
      });
  }
}
