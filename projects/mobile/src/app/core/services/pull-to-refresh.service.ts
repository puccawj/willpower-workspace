import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PullToRefreshService {
  private handler: (() => Promise<unknown>) | null = null;

  register(fn: () => Promise<unknown>): void {
    this.handler = fn;
  }

  clear(): void {
    this.handler = null;
  }

  async trigger(): Promise<void> {
    if (!this.handler) return;
    try {
      await this.handler();
    } catch {
      // Individual page load() calls already surface their own error state.
    }
  }
}
