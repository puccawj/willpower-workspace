import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PublicCourseApiService,
  PublicCourseOfferingCard,
  formatSchedule,
} from '../../core/services/public-course-api.service';

@Component({
  selector: 'app-courses',
  imports: [RouterLink],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class Courses {
  private readonly api = inject(PublicCourseApiService);

  readonly offerings = signal<PublicCourseOfferingCard[]>([]);
  readonly formatSchedule = formatSchedule;

  constructor() {
    this.api.loadAllOfferings().subscribe((rows) => this.offerings.set(rows));
  }
}
