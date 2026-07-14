import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { EventList } from './pages/events/event-list/event-list';
import { EventDetail } from './pages/events/event-detail/event-detail';
import { Courses } from './pages/courses/courses';
import { CourseDetail } from './pages/courses/course-detail/course-detail';
import { About } from './pages/about/about';
import { Team } from './pages/team/team';
import { Policy } from './pages/policy/policy';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { MyShell } from './pages/my/my-shell/my-shell';
import { MyDashboard } from './pages/my/my-dashboard/my-dashboard';
import { MyEvents } from './pages/my/my-events/my-events';
import { MyCourses } from './pages/my/my-courses/my-courses';
import { MyCertificates } from './pages/my/my-certificates/my-certificates';
import { MyDonations } from './pages/my/my-donations/my-donations';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'events', component: EventList },
  { path: 'events/:id', component: EventDetail },
  { path: 'courses', component: Courses },
  { path: 'courses/:id', component: CourseDetail },
  { path: 'about', component: About },
  { path: 'team', component: Team },
  { path: 'policy', component: Policy },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: 'my',
    component: MyShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: MyDashboard },
      { path: 'events', component: MyEvents },
      { path: 'courses', component: MyCourses },
      { path: 'certificates', component: MyCertificates },
      { path: 'donations', component: MyDonations },
    ],
  },
  { path: '**', redirectTo: '' },
];
