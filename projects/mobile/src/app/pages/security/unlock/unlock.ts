import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SecurityGateService } from '../../../core/services/security-gate.service';
import { PinPad } from '../../../shared/pin-pad/pin-pad';

const PIN_LENGTH = 4;

@Component({
  selector: 'app-unlock',
  imports: [PinPad],
  templateUrl: './unlock.html',
  styleUrl: './unlock.scss',
})
export class Unlock implements OnInit {
  private readonly gate = inject(SecurityGateService);
  private readonly router = inject(Router);

  readonly digits = signal('');
  readonly error = signal('');
  readonly checking = signal(false);
  readonly dots = Array.from({ length: PIN_LENGTH });

  async ngOnInit(): Promise<void> {
    const availability = await this.gate.biometricAvailability();
    if (availability?.isAvailable) {
      void this.tryBiometric();
    }
  }

  async tryBiometric(): Promise<void> {
    this.error.set('');
    const ok = await this.gate.verifyBiometric();
    if (ok) this.unlock();
  }

  async onDigit(d: string): Promise<void> {
    if (this.digits().length >= PIN_LENGTH || this.checking()) return;
    this.error.set('');
    const next = this.digits() + d;
    this.digits.set(next);

    if (next.length === PIN_LENGTH) {
      this.checking.set(true);
      const ok = await this.gate.verifyPin(next);
      this.checking.set(false);
      if (ok) {
        this.unlock();
      } else {
        this.error.set('Incorrect PIN — try again.');
        this.digits.set('');
      }
    }
  }

  onBackspace(): void {
    this.digits.set(this.digits().slice(0, -1));
  }

  private unlock(): void {
    this.gate.unlocked.set(true);
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }
}
