import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicEventApiService } from '../../core/services/public-event-api.service';
import { PublicCourseApiService } from '../../core/services/public-course-api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly eventsApi = inject(PublicEventApiService);
  private readonly coursesApi = inject(PublicCourseApiService);
  private readonly auth = inject(AuthService);

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly homeEvents = computed(() =>
    this.eventsApi
      .events()
      .filter((ev) => ev.when === 'upcoming' || ev.when === 'live')
      .slice(0, 3),
  );
  readonly homeCourses = computed(() => this.coursesApi.courses().slice(0, 3));

  constructor() {
    this.eventsApi.load().subscribe();
    this.coursesApi.load().subscribe();
  }
}
