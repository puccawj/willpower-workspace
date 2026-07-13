import { Component, Input } from '@angular/core';

export interface StatCardData {
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: string;
  sub?: string;
}

@Component({
  selector: 'app-stat-cards',
  imports: [],
  templateUrl: './stat-cards.html',
  styleUrl: './stat-cards.scss',
})
export class StatCards {
  @Input({ required: true }) stats: StatCardData[] = [];
}
