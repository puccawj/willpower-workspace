import { Component, computed, inject } from '@angular/core';
import { tap } from 'rxjs';
import {
  ApiCourseCategory,
  CourseCategoryApiService,
  CourseCategoryPayload,
} from '../../core/services/course-category-api.service';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';
import { ToastService } from '../../core/services/toast.service';
import { FieldDef } from '../../core/models/admin.models';

interface CategoryRow {
  key: string;
  name: string;
  active: boolean;
  statusLabel: string;
  statusColor: string;
  toggleLabel: string;
  toggleColor: string;
}

const FIELDS: FieldDef[] = [{ key: 'name', label: 'Category name', type: 'text', hint: 'e.g. "Meditation", "Study Circle"' }];

function toRow(c: ApiCourseCategory): CategoryRow {
  return {
    key: c.id,
    name: c.name,
    active: c.active,
    statusLabel: c.active ? 'Active' : 'Inactive',
    statusColor: c.active ? 'var(--w-green)' : 'var(--w-muted)',
    toggleLabel: c.active ? 'Deactivate' : 'Activate',
    toggleColor: c.active ? 'var(--w-red)' : 'var(--w-green)',
  };
}

@Component({
  selector: 'app-course-categories',
  imports: [TableToolbar],
  templateUrl: './course-categories.html',
  styleUrl: './course-categories.scss',
})
export class CourseCategories {
  private readonly api = inject(CourseCategoryApiService);
  private readonly modal = inject(CrudModalService);
  private readonly toast = inject(ToastService);

  readonly loading = this.api.loading;
  readonly error = this.api.error;

  private readonly rows = computed<CategoryRow[]>(() => this.api.categories().map(toRow));

  readonly ctrl = new ListController<CategoryRow>(this.rows);

  constructor() {
    this.api.load().subscribe();
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  toggleStatus(row: CategoryRow): void {
    this.api.update(row.key, { active: !row.active }).subscribe({
      next: () => this.toast.show(`${row.name} is now ${row.active ? 'inactive' : 'active'}.`, 'success'),
      error: (err) => this.showError(err, 'Failed to update category status.'),
    });
  }

  addCategory(): void {
    this.modal.open({
      title: 'Add Category',
      fields: FIELDS,
      isEdit: false,
      values: { name: '' },
      onSave: (values) => {
        const payload: CourseCategoryPayload = { name: String(values['name'] ?? '').trim() };
        return this.api.create(payload).pipe(tap({ error: (err) => this.showError(err, 'Failed to create category.') }));
      },
    });
  }

  editCategory(row: CategoryRow): void {
    this.modal.open({
      title: 'Edit Category',
      fields: FIELDS,
      isEdit: true,
      values: { name: row.name },
      onSave: (values) => {
        const payload: Partial<CourseCategoryPayload> = { name: String(values['name'] ?? '').trim() };
        return this.api.update(row.key, payload).pipe(tap({ error: (err) => this.showError(err, 'Failed to update category.') }));
      },
      onDelete: () => this.api.remove(row.key).pipe(tap({ error: (err) => this.showError(err, 'Failed to delete category.') })),
    });
  }
}
