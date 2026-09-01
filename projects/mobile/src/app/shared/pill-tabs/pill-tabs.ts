import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface PillTabOption {
  key: string;
  label: string;
}

@Component({
  selector: 'app-pill-tabs',
  templateUrl: './pill-tabs.html',
  styleUrl: './pill-tabs.scss',
})
export class PillTabs {
  @Input({ required: true }) options: PillTabOption[] = [];
  @Input() active = '';
  @Output() activeChange = new EventEmitter<string>();

  select(key: string): void {
    if (key !== this.active) this.activeChange.emit(key);
  }
}
