import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityGateService } from '../../../core/services/security-gate.service';
import { PinPad } from '../../../shared/pin-pad/pin-pad';

const PIN_LENGTH = 4;

@Component({
  selector: 'app-set-pin',
  imports: [PinPad],
  templateUrl: './set-pin.html',
  styleUrl: './set-pin.scss',
})
export class SetPin {
  private readonly gate = inject(SecurityGateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/home';

  readonly stage = signal<'enter' | 'confirm'>('enter');
  readonly digits = signal('');
  readonly error = signal('');
  private firstPin = '';

  readonly dots = Array.from({ length: PIN_LENGTH });

  onDigit(d: string): void {
    if (this.digits().length >= PIN_LENGTH) return;
    this.error.set('');
    const next = this.digits() + d;
    this.digits.set(next);
    if (next.length === PIN_LENGTH) {
      setTimeout(() => this.onComplete(next), 150);
    }
  }

  onBackspace(): void {
    this.digits.set(this.digits().slice(0, -1));
  }

  skip(): void {
    void this.gate.markPinSetupSeen().then(() => this.finish());
  }

  private onComplete(pin: string): void {
    if (this.stage() === 'enter') {
      this.firstPin = pin;
      this.stage.set('confirm');
      this.digits.set('');
      return;
    }

    if (pin !== this.firstPin) {
      this.error.set("PINs didn't match — try again.");
      this.stage.set('enter');
      this.digits.set('');
      this.firstPin = '';
      return;
    }

    void this.gate.setPin(pin).then(() => this.finish());
  }

  private finish(): void {
    this.gate.unlocked.set(true);
    this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
  }
}
