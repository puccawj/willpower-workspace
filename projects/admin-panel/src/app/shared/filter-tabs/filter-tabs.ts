import { Component, Input } from '@angular/core';

export interface FilterOption {
  key: string;
  label: string;
}

@Component({
  selector: 'app-filter-tabs',
  imports: [],
  templateUrl: './filter-tabs.html',
  styleUrl: './filter-tabs.scss',
})
export class FilterTabs {
  @Input({ required: true }) options: FilterOption[] = [];
  @Input({ required: true }) active = '';
  @Input({ required: true }) select!: (key: string) => void;
}
