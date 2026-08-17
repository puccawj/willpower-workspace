import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface TypeaheadOption {
  id: string;
  label: string;
}

export interface TypeaheadListPosition {
  top: number;
  left: number;
  width: number;
}

/** Reusable relational picker: carries an id alongside its display label, backed by a real
 * (styleable, automatable) dropdown list instead of a native <datalist> popup. */
@Component({
  selector: 'app-typeahead',
  imports: [FormsModule],
  templateUrl: './typeahead.html',
  styleUrl: './typeahead.scss',
})
export class Typeahead {
  readonly options = input<TypeaheadOption[]>([]);
  readonly value = input<string>('');
  readonly placeholder = input('Search…');
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  readonly query = signal('');
  readonly open = signal(false);
  /** Rendered via position:fixed at these viewport coordinates instead of position:absolute, so
   * the list escapes any ancestor with overflow:auto/hidden (e.g. a scrollable modal dialog)
   * instead of being clipped at that ancestor's edge. */
  readonly listPosition = signal<TypeaheadListPosition | null>(null);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    if (!q) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(q));
  });

  constructor() {
    // Keep the visible text in sync with the current id — but only while the dropdown is
    // closed, so we don't stomp on what the user is actively typing.
    effect(() => {
      const val = this.value();
      const opts = this.options();
      if (this.open()) return;
      const match = opts.find((o) => o.id === val);
      this.query.set(match ? match.label : '');
    });
  }

  private updateListPosition(): void {
    const el = this.inputRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.listPosition.set({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  onFocus(): void {
    this.updateListPosition();
    this.open.set(true);
  }

  onInput(text: string): void {
    this.query.set(text);
    this.updateListPosition();
    this.open.set(true);
    if (!text) this.valueChange.emit('');
  }

  onBlur(): void {
    // Delay so a mousedown on an option (below) fires before the list disappears.
    setTimeout(() => this.open.set(false), 150);
  }

  select(opt: TypeaheadOption): void {
    this.query.set(opt.label);
    this.valueChange.emit(opt.id);
    this.open.set(false);
  }
}
