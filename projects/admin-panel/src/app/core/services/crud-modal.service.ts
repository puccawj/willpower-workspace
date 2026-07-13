import { inject, Injectable, signal } from '@angular/core';
import { isObservable, Observable } from 'rxjs';
import { FieldDef } from '../models/admin.models';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';

export type CrudModalResult = void | Observable<unknown> | Promise<unknown>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CrudModalConfig {
  title: string;
  fields: FieldDef[];
  values: Record<string, string | number>;
  isEdit: boolean;
  onSave: (values: Record<string, string | number>) => CrudModalResult;
  onDelete?: () => CrudModalResult;
}

@Injectable({ providedIn: 'root' })
export class CrudModalService {
  private readonly toast = inject(ToastService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly config = signal<CrudModalConfig | null>(null);

  open(config: CrudModalConfig): void {
    this.config.set(config);
  }

  close(): void {
    this.config.set(null);
  }

  setFieldValue(key: string, value: string | number): void {
    const current = this.config();
    if (!current) return;
    this.config.set({ ...current, values: { ...current.values, [key]: value } });
  }

  save(): void {
    const current = this.config();
    if (!current) return;
    const values = { ...current.values };
    current.fields
      .filter((f) => f.type === 'number')
      .forEach((f) => {
        values[f.key] = Number(values[f.key]) || 0;
      });

    const invalidEmailField = current.fields.find((f) => {
      if (f.type !== 'email') return false;
      const value = String(values[f.key] ?? '').trim();
      return value.length > 0 && !EMAIL_PATTERN.test(value);
    });
    if (invalidEmailField) {
      this.toast.show(`Please enter a valid email for "${invalidEmailField.label}".`, 'error');
      return;
    }

    const invalidPasswordField = current.fields.find((f) => {
      if (f.type !== 'password') return false;
      const value = String(values[f.key] ?? '').trim();
      if (!value) return !current.isEdit;
      return value.length < 8;
    });
    if (invalidPasswordField) {
      const value = String(values[invalidPasswordField.key] ?? '').trim();
      const message = value
        ? `"${invalidPasswordField.label}" must be at least 8 characters.`
        : `Please enter a "${invalidPasswordField.label}".`;
      this.toast.show(message, 'error');
      return;
    }

    const label = this.entityLabel(current.title);
    const successMessage = `${label} ${current.isEdit ? 'updated' : 'created'} successfully.`;
    this.settle(current.onSave(values), successMessage);
  }

  async delete(): Promise<void> {
    const current = this.config();
    if (!current?.onDelete) {
      this.close();
      return;
    }

    const label = this.entityLabel(current.title);
    const confirmed = await this.confirmSvc.ask(`Delete this ${label.toLowerCase()}? This cannot be undone.`, {
      title: `Delete ${label}`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.settle(current.onDelete(), `${label} deleted successfully.`);
  }

  private entityLabel(title: string): string {
    return title.replace(/^(add|edit|new|create)\s+/i, '').trim() || 'Item';
  }

  /** Lets a resolved value override the generic success toast via a `toastMessage` property. */
  private resolveMessage(value: unknown, fallback: string): string {
    if (value && typeof value === 'object' && 'toastMessage' in value) {
      return String((value as { toastMessage: unknown }).toastMessage);
    }
    return fallback;
  }

  /** Closes immediately for synchronous callers; waits for async ones and stays open on error. */
  private settle(result: CrudModalResult, successMessage: string): void {
    if (isObservable(result)) {
      result.subscribe({
        next: (value) => {
          this.toast.show(this.resolveMessage(value, successMessage), 'success');
          this.close();
        },
        error: () => {},
      });
    } else if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(
        (value) => {
          this.toast.show(this.resolveMessage(value, successMessage), 'success');
          this.close();
        },
        () => {},
      );
    } else {
      this.toast.show(successMessage, 'success');
      this.close();
    }
  }
}
