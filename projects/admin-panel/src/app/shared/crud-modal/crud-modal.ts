import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CITIES_BY_COUNTRY } from '../../core/data/cities';
import { COUNTRIES, CountryDialCode } from '../../core/data/countries';
import { TIMEZONES } from '../../core/data/timezones';
import { CrudModalService } from '../../core/services/crud-modal.service';
import { FieldDef } from '../../core/models/admin.models';

const DEFAULT_COUNTRY_ISO = 'TH';
export const MULTISELECT_DELIM = '||';

/** Images wider or taller than this are downscaled before upload so files stay small and consistent. */
const MAX_IMAGE_DIMENSION = 1600;

/** Several dial codes are shared by multiple countries (e.g. +1 = US/CA/many Caribbean nations). */
const PRIMARY_ISO_FOR_DIAL: Record<string, string> = {
  '+1': 'US',
  '+7': 'RU',
  '+44': 'GB',
  '+61': 'AU',
  '+212': 'MA',
  '+262': 'RE',
  '+290': 'SH',
  '+358': 'FI',
  '+590': 'GP',
  '+599': 'CW',
};

@Component({
  selector: 'app-crud-modal',
  imports: [FormsModule],
  templateUrl: './crud-modal.html',
  styleUrl: './crud-modal.scss',
})
export class CrudModal {
  readonly modal = inject(CrudModalService);
  readonly countries = COUNTRIES;
  readonly countryNames = COUNTRIES.map((c) => c.name).sort((a, b) => a.localeCompare(b));
  readonly timezones = TIMEZONES;

  readonly openMultiSelectKey = signal<string | null>(null);

  @HostListener('document:click')
  closeMultiSelectDropdown(): void {
    this.openMultiSelectKey.set(null);
  }

  onDialogClick(event: Event): void {
    event.stopPropagation();
    this.openMultiSelectKey.set(null);
  }

  onFieldChange(key: string, value: string): void {
    this.modal.setFieldValue(key, value);
  }

  onImageSelected(key: string, input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    this.resizeImageFile(file).then(
      (dataUri) => this.modal.setFieldValue(key, dataUri),
      () => this.modal.setFieldValue(key, ''),
    );
  }

  /** Downscales large photos to `MAX_IMAGE_DIMENSION` (preserving aspect ratio) so previews/uploads fit consistently. */
  private resizeImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const original = String(reader.result);
        const img = new Image();
        img.onerror = () => reject(new Error('Could not read image file.'));
        img.onload = () => {
          const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
          if (scale >= 1) {
            resolve(original);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(original);
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.85 : undefined));
        };
        img.src = original;
      };
      reader.readAsDataURL(file);
    });
  }

  selectedCountryIso(field: FieldDef): string {
    const dial = field.countryKey ? String(this.modal.config()?.values[field.countryKey] ?? '') : '';
    if (!dial) return DEFAULT_COUNTRY_ISO;
    if (PRIMARY_ISO_FOR_DIAL[dial]) return PRIMARY_ISO_FOR_DIAL[dial];
    const match = this.countries.find((c) => c.dial === dial);
    return match?.iso ?? DEFAULT_COUNTRY_ISO;
  }

  countryFlagUrl(iso: string): string {
    return `https://purecatamphetamine.github.io/country-flag-icons/3x2/${iso}.svg`;
  }

  onCountryChange(field: FieldDef, iso: string): void {
    if (!field.countryKey) return;
    const country = this.countries.find((c) => c.iso === iso);
    if (country) this.modal.setFieldValue(field.countryKey, country.dial);
  }

  trackCountry(_index: number, country: CountryDialCode): string {
    return country.iso;
  }

  comboboxOptions(field: FieldDef): string[] {
    if (!field.dependsOn) return field.options ?? [];
    const countryName = String(this.modal.config()?.values[field.dependsOn] ?? '').trim();
    const country = this.countries.find((c) => c.name.toLowerCase() === countryName.toLowerCase());
    return (country && CITIES_BY_COUNTRY[country.iso]) ?? [];
  }

  multiSelectValues(field: FieldDef): string[] {
    const raw = String(this.modal.config()?.values[field.key] ?? '');
    return raw ? raw.split(MULTISELECT_DELIM) : [];
  }

  isMultiSelected(field: FieldDef, option: string): boolean {
    if (field.selectAllLabel && option === field.selectAllLabel) return this.isAllSelected(field);
    return this.multiSelectValues(field).includes(option);
  }

  toggleMultiSelect(field: FieldDef, option: string, checked: boolean): void {
    if (field.selectAllLabel && option === field.selectAllLabel) {
      const allOptions = field.options ?? [];
      this.modal.setFieldValue(field.key, checked ? allOptions.join(MULTISELECT_DELIM) : '');
      return;
    }

    const current = this.multiSelectValues(field);
    const next = checked ? [...current, option] : current.filter((o) => o !== option);
    this.modal.setFieldValue(field.key, next.join(MULTISELECT_DELIM));
  }

  multiSelectSummary(field: FieldDef): string {
    if (field.selectAllLabel && this.isAllSelected(field)) return field.selectAllLabel;
    const values = this.multiSelectValues(field);
    return values.length ? values.join(', ') : `Select ${field.label.toLowerCase()}…`;
  }

  private isAllSelected(field: FieldDef): boolean {
    const allOptions = field.options ?? [];
    if (allOptions.length === 0) return false;
    const selected = this.multiSelectValues(field);
    return allOptions.every((o) => selected.includes(o));
  }

  isMultiSelectOpen(field: FieldDef): boolean {
    return this.openMultiSelectKey() === field.key;
  }

  toggleMultiSelectOpen(field: FieldDef, event: Event): void {
    event.stopPropagation();
    this.openMultiSelectKey.set(this.isMultiSelectOpen(field) ? null : field.key);
  }
}
