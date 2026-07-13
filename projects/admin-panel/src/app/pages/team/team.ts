import { Component, computed, inject } from '@angular/core';
import { map, of, switchMap, tap, Observable } from 'rxjs';
import { avatarColorFor, initialsOf } from '../../core/services/admin-data.service';
import { ApiTeamMember, TeamMemberApiService, TeamMemberPayload } from '../../core/services/team-member-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ImageViewerService } from '../../core/services/image-viewer.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FieldDef } from '../../core/models/admin.models';

interface TeamRow {
  id: string;
  name: string;
  position: string;
  bio: string;
  branchId: string;
  branchName: string;
  photoUrl: string;
  displayOrder: number;
  isShown: boolean;
  shownLabel: string;
  initials: string;
  avatarColor: string;
}

function buildFields(branchNames: string[]): FieldDef[] {
  return [
    { key: 'name', label: 'Full name', type: 'text' },
    { key: 'position', label: 'Role/title', type: 'text' },
    { key: 'branch', label: 'Branch', type: 'combobox', options: branchNames },
    { key: 'shown', label: 'Shown on site', type: 'select', options: ['Yes', 'No'] },
    { key: 'photo', label: 'Photo', type: 'image' },
  ];
}

function toRow(m: ApiTeamMember): TeamRow {
  return {
    id: m.id,
    name: m.name,
    position: m.position ?? '',
    bio: m.bio ?? '',
    branchId: m.branchId,
    branchName: m.branchName,
    photoUrl: m.photoUrl ?? '',
    displayOrder: m.displayOrder,
    isShown: m.isShown,
    shownLabel: m.isShown ? 'Yes' : 'No',
    initials: initialsOf(m.name),
    avatarColor: avatarColorFor(m.name),
  };
}

@Component({
  selector: 'app-team',
  imports: [TableToolbar],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team {
  private readonly api = inject(TeamMemberApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly modal = inject(CrudModalService);
  private readonly uploads = inject(UploadApiService);
  private readonly toast = inject(ToastService);
  private readonly imageViewer = inject(ImageViewerService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  private readonly branchNames = computed(() => this.branchApi.branches().map((b) => b.name));
  private readonly branchNameToId = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.name.toLowerCase(), b.id));
    return map;
  });

  private readonly rows = computed<TeamRow[]>(() => this.api.members().map(toRow));

  readonly ctrl = new ListController<TeamRow>(this.rows);

  constructor() {
    this.api.load().subscribe();
    this.branchApi.load().subscribe();
  }

  viewPhoto(row: TeamRow): void {
    if (row.photoUrl) this.imageViewer.open(row.photoUrl);
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private toPayload(values: Record<string, string | number>): TeamMemberPayload {
    const branchId = this.branchNameToId().get(String(values['branch'] ?? '').trim().toLowerCase()) ?? '';
    return {
      name: String(values['name'] ?? '').trim(),
      position: String(values['position'] ?? '').trim() || undefined,
      branchId,
      isShown: String(values['shown'] ?? 'Yes') === 'Yes',
    };
  }

  private resolvePayload(values: Record<string, string | number>): Observable<TeamMemberPayload> {
    const payload = this.toPayload(values);
    const photo = String(values['photo'] ?? '');
    if (photo.startsWith('data:')) {
      return this.uploads.uploadDataUri(photo).pipe(map((url) => ({ ...payload, photo: url })));
    }
    if (photo) payload.photo = photo;
    return of(payload);
  }

  addMember(): void {
    this.modal.open({
      title: 'Add Team Member',
      fields: buildFields(this.branchNames()),
      isEdit: false,
      values: { name: '', position: '', branch: '', shown: 'Yes', photo: '' },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.create(payload)),
          tap({ error: (err) => this.showError(err, 'Failed to add team member.') }),
        ),
    });
  }

  editMember(row: TeamRow): void {
    this.modal.open({
      title: 'Edit Team Member',
      fields: buildFields(this.branchNames()),
      isEdit: true,
      values: {
        name: row.name,
        position: row.position,
        branch: row.branchName === '—' ? '' : row.branchName,
        shown: row.shownLabel,
        photo: row.photoUrl,
      },
      onSave: (values) =>
        this.resolvePayload(values).pipe(
          switchMap((payload) => this.api.update(row.id, payload)),
          tap({ error: (err) => this.showError(err, 'Failed to update team member.') }),
        ),
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete team member.') })),
    });
  }
}
