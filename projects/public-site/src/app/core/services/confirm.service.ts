import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolver: ((result: boolean) => void) | null = null;

  ask(message: string, options?: { title?: string; confirmLabel?: string }): Promise<boolean> {
    this.request.set({
      title: options?.title ?? 'Are you sure?',
      message,
      confirmLabel: options?.confirmLabel ?? 'Confirm',
    });
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(result: boolean): void {
    this.resolver?.(result);
    this.resolver = null;
    this.request.set(null);
  }
}
