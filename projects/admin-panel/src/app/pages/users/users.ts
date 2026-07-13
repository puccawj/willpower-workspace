import { Component, computed, effect, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { avatarColorFor, initialsOf } from '../../core/services/admin-data.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { ApiRegistrationSource, ApiUserRole, ApiUserStatus, UserApiService, UserPayload } from '../../core/services/user-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { RoleService } from '../../core/services/role.service';
import { MULTISELECT_DELIM } from '../../shared/crud-modal/crud-modal';
import { ExcelService } from '../../core/services/excel.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { FilterTabs, FilterOption } from '../../shared/filter-tabs/filter-tabs';
import { FieldDef } from '../../core/models/admin.models';

interface UserRow {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  role: ApiUserRole;
  roleLabel: string;
  branchNames: string[];
  branchNamesLabel: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  initials: string;
  avatarColor: string;
  statusKey: ApiUserStatus;
  statusLabel: string;
  statusColor: string;
  registrationSource: ApiRegistrationSource;
  registrationLabel: string;
  actionLabel: string;
  actionColor: string;
}

const ROLE_LABEL: Record<ApiUserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  instructor: 'Instructor',
  student: 'Student',
  general: 'General',
};

const STATUS_LABEL: Record<ApiUserStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending_verification: 'Pending',
};

const STATUS_COLOR: Record<ApiUserStatus, string> = {
  active: 'var(--w-green)',
  suspended: 'var(--w-red)',
  pending_verification: 'var(--w-gold)',
};

const REGISTRATION_LABEL: Record<ApiRegistrationSource, string> = {
  admin: 'Admin-created',
  self: 'Self-registered',
  google: 'Google',
  facebook: 'Facebook',
};

const ROLE_OPTIONS = ['Student', 'Instructor', 'Admin', 'General'];
const ROLE_TO_API: Record<string, ApiUserRole> = {
  Student: 'student',
  Instructor: 'instructor',
  Admin: 'admin',
  General: 'general',
  Superadmin: 'superadmin',
};
const MANAGEABLE_ROLES: ApiUserRole[] = ['student', 'instructor', 'admin', 'general'];

function buildFields(isEdit: boolean, branchNames: string[], canManageSuperadmin: boolean, isSso: boolean): FieldDef[] {
  const roleOptions = canManageSuperadmin ? [...ROLE_OPTIONS, 'Superadmin'] : ROLE_OPTIONS;
  const passwordField: FieldDef[] = isSso
    ? []
    : [
        {
          key: 'password',
          label: isEdit ? 'New password' : 'Password',
          type: 'password',
          hint: isEdit ? 'Leave blank to keep the current password.' : 'Minimum 8 characters.',
        },
      ];
  return [
    { key: 'firstName', label: 'First name', type: 'text' },
    { key: 'lastName', label: 'Last name', type: 'text' },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      readonly: isEdit,
      hint: isEdit ? 'Email cannot be changed after the account is created.' : undefined,
    },
    ...passwordField,
    { key: 'role', label: 'Role', type: 'select', options: roleOptions },
    { key: 'phoneNumber', label: 'Phone Number', type: 'phone', countryKey: 'phoneCountryCode' },
    { key: 'branches', label: 'Branches', type: 'multiselect', options: branchNames, selectAllLabel: 'All Branches' },
  ];
}

function toPayload(values: Record<string, string | number>, branchNameToId: Map<string, string>): UserPayload {
  const payload: UserPayload = {
    firstName: String(values['firstName'] ?? '').trim(),
    lastName: String(values['lastName'] ?? '').trim(),
    email: String(values['email'] ?? '').trim(),
    role: ROLE_TO_API[String(values['role'] ?? '')] ?? 'student',
  };

  const password = String(values['password'] ?? '').trim();
  if (password) payload.password = password;

  const branchNames = String(values['branches'] ?? '')
    .split(MULTISELECT_DELIM)
    .map((n) => n.trim())
    .filter(Boolean);
  payload.branchIds = branchNames
    .map((name) => branchNameToId.get(name.toLowerCase()))
    .filter((id): id is string => Boolean(id));

  const phoneCountryCode = String(values['phoneCountryCode'] ?? '').trim();
  const phoneNumber = String(values['phoneNumber'] ?? '').trim();
  if (phoneCountryCode) payload.phoneCountryCode = phoneCountryCode;
  if (phoneNumber) payload.phoneNumber = phoneNumber;

  return payload;
}

@Component({
  selector: 'app-users',
  imports: [TableToolbar, FilterTabs],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  private readonly api = inject(UserApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly modal = inject(CrudModalService);
  private readonly excel = inject(ExcelService);
  private readonly toast = inject(ToastService);
  private readonly roleService = inject(RoleService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  readonly filter = signal('all');

  private static readonly BASE_FILTER_OPTIONS: FilterOption[] = [
    { key: 'all', label: 'All' },
    { key: 'student', label: 'Students' },
    { key: 'instructor', label: 'Instructors' },
    { key: 'admin', label: 'Admins' },
    { key: 'general', label: 'General' },
  ];

  readonly filterOptions = computed<FilterOption[]>(() =>
    this.roleService.isSuper()
      ? [...Users.BASE_FILTER_OPTIONS, { key: 'superadmin', label: 'Superadmins' }]
      : Users.BASE_FILTER_OPTIONS,
  );

  private readonly branchNameById = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.id, b.name));
    return map;
  });

  private readonly branchNameToId = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.name.toLowerCase(), b.id));
    return map;
  });

  private readonly branchNames = computed(() => this.branchApi.branches().map((b) => b.name));

  private readonly rows = computed<UserRow[]>(() => {
    const branchNameById = this.branchNameById();
    return this.api.users().map((u) => {
      const active = u.status === 'active';
      const branchNames = u.branchIds.map((id) => branchNameById.get(id)).filter((n): n is string => Boolean(n));
      return {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        roleLabel: ROLE_LABEL[u.role],
        branchNames,
        branchNamesLabel: branchNames.length ? branchNames.join(', ') : '—',
        email: u.email,
        phoneCountryCode: u.phoneCountryCode ?? '',
        phoneNumber: u.phoneNumber ?? '',
        initials: initialsOf(`${u.firstName} ${u.lastName}`),
        avatarColor: avatarColorFor(`${u.firstName} ${u.lastName}`),
        statusKey: u.status,
        statusLabel: STATUS_LABEL[u.status],
        registrationSource: u.registrationSource,
        registrationLabel: REGISTRATION_LABEL[u.registrationSource],
        statusColor: STATUS_COLOR[u.status],
        actionLabel: active ? 'Suspend' : 'Reactivate',
        actionColor: active ? 'var(--w-red)' : 'var(--w-green)',
      };
    });
  });

  private readonly filteredRows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.rows() : this.rows().filter((u) => u.role === f);
  });

  readonly ctrl = new ListController<UserRow>(this.filteredRows);

  constructor() {
    this.api.load().subscribe();
    this.branchApi.load().subscribe();

    effect(() => {
      if (this.filter() === 'superadmin' && !this.roleService.isSuper()) {
        this.filter.set('all');
      }
    });
  }

  setFilter = (key: string) => this.filter.set(key);

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  toggleStatus(row: UserRow): void {
    const nextStatus: ApiUserStatus = row.statusKey === 'active' ? 'suspended' : 'active';
    this.api.update(row.id, { status: nextStatus }).subscribe({
      next: () => this.toast.show(`${row.name} is now ${nextStatus}.`, 'success'),
      error: (err) => this.showError(err, 'Failed to update user status.'),
    });
  }

  addUser(): void {
    this.modal.open({
      title: 'Add User',
      fields: buildFields(false, this.branchNames(), this.roleService.isSuper(), false),
      isEdit: false,
      values: {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'Student',
        branches: '',
        phoneCountryCode: '',
        phoneNumber: '',
      },
      onSave: (values) =>
        this.api
          .create(toPayload(values, this.branchNameToId()))
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to create user.') })),
    });
  }

  editUser(row: UserRow): void {
    this.modal.open({
      title: 'Edit User',
      fields: buildFields(
        true,
        this.branchNames(),
        this.roleService.isSuper(),
        row.registrationSource === 'google' || row.registrationSource === 'facebook',
      ),
      isEdit: true,
      values: {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        password: '',
        role: ROLE_LABEL[row.role] ?? '',
        branches: row.branchNames.join(MULTISELECT_DELIM),
        phoneCountryCode: row.phoneCountryCode,
        phoneNumber: row.phoneNumber,
      },
      onSave: (values) =>
        this.api
          .update(row.id, toPayload(values, this.branchNameToId()))
          .pipe(tap({ error: (err) => this.showError(err, 'Failed to update user.') })),
      onDelete: () =>
        this.api.remove(row.id).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete user.') })),
    });
  }

  private cell(row: Record<string, string>, ...keys: string[]): string {
    for (const key of Object.keys(row)) {
      if (keys.some((k) => k.toLowerCase() === key.toLowerCase())) return String(row[key]).trim();
    }
    return '';
  }

  async importFromFile(file: File): Promise<void> {
    let rows: Record<string, string>[];
    try {
      rows = await this.excel.parseFile(file);
    } catch {
      this.toast.show('Could not read that file — expected an .xlsx or .csv export.', 'error');
      return;
    }

    const branchNameToId = this.branchNameToId();
    const candidates = rows
      .map((r) => {
        const fullName = this.cell(r, 'name', 'full name');
        const firstName = this.cell(r, 'first name', 'firstname') || fullName.split(' ')[0] || '';
        const lastName = this.cell(r, 'last name', 'lastname') || fullName.split(' ').slice(1).join(' ');
        const email = this.cell(r, 'email');
        const roleRaw = this.cell(r, 'role').toLowerCase() as ApiUserRole;
        const role = MANAGEABLE_ROLES.includes(roleRaw) ? roleRaw : 'student';
        const branchId = branchNameToId.get(this.cell(r, 'branch').toLowerCase());
        const payload: UserPayload = { firstName, lastName, email, role, password: 'Welcome123!' };
        if (branchId) payload.branchIds = [branchId];
        return payload;
      })
      .filter((c) => c.firstName && c.email);

    if (candidates.length === 0) {
      this.toast.show('No valid rows found — make sure the file has "email" and "name" columns.', 'warning');
      return;
    }

    let imported = 0;
    let failed = 0;
    for (const payload of candidates) {
      const ok = await new Promise<boolean>((resolve) => {
        this.api.create(payload).subscribe({ next: () => resolve(true), error: () => resolve(false) });
      });
      if (ok) imported++;
      else failed++;
    }

    if (imported === 0) {
      this.toast.show(`Could not import any users from ${file.name} (check for duplicate emails).`, 'error');
    } else {
      const suffix = failed ? ` (${failed} skipped — duplicate email or invalid data)` : '';
      this.toast.show(`Imported ${imported} user${imported === 1 ? '' : 's'} from ${file.name}${suffix}.`, failed ? 'warning' : 'success');
    }
  }
}
