import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface TypeaheadOption {
  id: string;
  label: string;
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

  readonly query = signal('');
  readonly open = signal(false);

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

  onFocus(): void {
    this.open.set(true);
  }

  onInput(text: string): void {
    this.query.set(text);
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
