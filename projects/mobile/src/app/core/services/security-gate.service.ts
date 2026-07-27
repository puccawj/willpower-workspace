import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { AvailableResult, NativeBiometric } from '@capgo/capacitor-native-biometric';

const PIN_SEEN_KEY = 'willpower.pin-setup-seen';
const PIN_HASH_KEY = 'willpower.pin-hash';
const PIN_SALT_KEY = 'willpower.pin-salt';

/**
 * The PIN/biometric gate is a local re-entry check, not a second authentication system —
 * the session itself lives in AuthService/Preferences as always. This service just decides
 * whether the app should ask "is it really you" before showing what's already cached, and
 * remembers that decision for the lifetime of one cold start via `unlocked`.
 */
@Injectable({ providedIn: 'root' })
export class SecurityGateService {
  readonly isNative = Capacitor.isNativePlatform();

  /** Set once per cold start after a successful biometric/PIN check or full login. Reset
   * only by a fresh app process — this is intentionally in-memory, not persisted. */
  readonly unlocked = signal(!this.isNative);

  async hasSeenPinSetup(): Promise<boolean> {
    const { value } = await Preferences.get({ key: PIN_SEEN_KEY });
    return value === '1';
  }

  async markPinSetupSeen(): Promise<void> {
    await Preferences.set({ key: PIN_SEEN_KEY, value: '1' });
  }

  async isPinConfigured(): Promise<boolean> {
    const { value } = await Preferences.get({ key: PIN_HASH_KEY });
    return !!value;
  }

  async setPin(pin: string): Promise<void> {
    const salt = crypto.randomUUID();
    const hash = await this.hashPin(pin, salt);
    await Preferences.set({ key: PIN_SALT_KEY, value: salt });
    await Preferences.set({ key: PIN_HASH_KEY, value: hash });
    await this.markPinSetupSeen();
  }

  async verifyPin(pin: string): Promise<boolean> {
    const [{ value: salt }, { value: storedHash }] = await Promise.all([
      Preferences.get({ key: PIN_SALT_KEY }),
      Preferences.get({ key: PIN_HASH_KEY }),
    ]);
    if (!salt || !storedHash) return false;
    return (await this.hashPin(pin, salt)) === storedHash;
  }

  async clearPin(): Promise<void> {
    await Promise.all([Preferences.remove({ key: PIN_HASH_KEY }), Preferences.remove({ key: PIN_SALT_KEY })]);
  }

  async biometricAvailability(): Promise<AvailableResult | null> {
    if (!this.isNative) return null;
    try {
      return await NativeBiometric.isAvailable();
    } catch {
      return null;
    }
  }

  async verifyBiometric(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      await NativeBiometric.verifyIdentity({
        title: 'Confirm it’s you',
        reason: 'Unlock Willpower Institute',
      });
      return true;
    } catch {
      return false;
    }
  }

  private async hashPin(pin: string, salt: string): Promise<string> {
    const data = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
