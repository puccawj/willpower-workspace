import { Component, EventEmitter, Output } from '@angular/core';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

@Component({
  selector: 'app-pin-pad',
  imports: [],
  templateUrl: './pin-pad.html',
  styleUrl: './pin-pad.scss',
})
export class PinPad {
  @Output() readonly digit = new EventEmitter<string>();
  @Output() readonly backspace = new EventEmitter<void>();

  readonly keys = KEYS;

  press(key: string): void {
    if (!key) return;
    if (key === '⌫') {
      this.backspace.emit();
      return;
    }
    this.digit.emit(key);
  }
}
