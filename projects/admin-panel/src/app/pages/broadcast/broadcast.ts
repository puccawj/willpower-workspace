import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ListController } from '../../core/list-controller';
import { BranchApiService } from '../../core/services/branch-api.service';
import { BroadcastApiService, BroadcastHistoryRow } from '../../core/services/broadcast-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { RoleService } from '../../core/services/role.service';
import { ToastService } from '../../core/services/toast.service';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';

@Component({
  selector: 'app-broadcast',
  imports: [FormsModule, DatePipe, TableToolbar],
  templateUrl: './broadcast.html',
  styleUrl: './broadcast.scss',
})
export class Broadcast {
  private readonly api = inject(BroadcastApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly roleService = inject(RoleService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly isSuper = this.roleService.isSuper;
  readonly branches = this.branchApi.branches;
  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly ctrl = new ListController<BroadcastHistoryRow>(this.api.history);

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

  async deleteBroadcast(row: BroadcastHistoryRow): Promise<void> {
    const confirmed = await this.confirmSvc.ask(`Delete the broadcast "${row.title}"? This removes it for every recipient and cannot be undone.`, {
      title: 'Delete Broadcast',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.api.deleteBroadcast(row.broadcastId).subscribe({
      next: () => this.toast.show('Broadcast deleted.', 'success'),
      error: (err) => this.toast.show(err?.error?.message ?? 'Failed to delete broadcast.', 'error'),
    });
  }
}
