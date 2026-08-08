import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'willpower.text-scale';

export interface TextScaleOption {
  value: number;
  label: string;
}

/** Every font-size in the app is written as `calc(Npx * var(--text-scale, 1))` — the
 * px values are already the "Normal" (1×) baseline (bumped up once app-wide for
 * readability), so this just lets a user scale further up or down from there without
 * touching a single component's CSS. */
export const TEXT_SCALE_OPTIONS: TextScaleOption[] = [
  { value: 0.85, label: 'Small' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Extra large' },
];

@Injectable({ providedIn: 'root' })
export class TextScaleService {
  readonly scale = signal(1);

  async init(): Promise<void> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    const parsed = value ? Number(value) : 1;
    const scale = TEXT_SCALE_OPTIONS.some((o) => o.value === parsed) ? parsed : 1;
    this.apply(scale);
  }

  async setScale(scale: number): Promise<void> {
    this.apply(scale);
    await Preferences.set({ key: STORAGE_KEY, value: String(scale) });
  }

  private apply(scale: number): void {
    this.scale.set(scale);
    document.documentElement.style.setProperty('--text-scale', String(scale));
  }
}
