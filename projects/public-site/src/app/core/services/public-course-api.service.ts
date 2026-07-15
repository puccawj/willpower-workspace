import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiPublicCourseRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  totalSessions: number;
  passingAttendancePercent: number;
  offeringsCount: number;
  modes: ('online' | 'onsite')[];
  isOpenForEnrollment: boolean;
}

interface ApiPublicCourseDetailRow extends ApiPublicCourseRow {
  syllabus: string | null;
}

export interface PublicCourse {
  id: string;
  level: string;
  format: string;
  img: string;
  title: string;
  desc: string;
  sessions: string;
  offeringsCount: number;
  pass: string;
  open: string;
  isOpenForEnrollment: boolean;
}

export interface PublicCourseDetail extends PublicCourse {
  syllabusTopics: string[];
}

export interface PublicOffering {
  id: string;
  branchId: string;
  branchName: string;
  mode: 'online' | 'onsite';
  location: string | null;
  startDate: string;
  endDate: string;
  spotsLeft: number | null;
}

export interface PublicCourseNeed {
  id: string;
  sessionNumber: number | null;
  title: string;
  type: 'money' | 'goods';
  unit: string | null;
  targetQuantity: string;
  receivedQuantity: string;
}

export interface PublicDonationRow {
  id: string;
  donorName: string;
  type: 'money' | 'goods';
  amount: string | null;
  itemDescription: string | null;
  quantity: string | null;
  needTitle: string | null;
  createdAt: string;
}

export interface PublicCoursePhoto {
  id: string;
  imageUrl: string;
  caption: string | null;
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1772034292097-447be2dd32ea?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1589862607042-7e09233f593b?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1505191419261-8ccbb5ac8f93?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1566499175117-c78fabf20b7d?q=80&w=1200&auto=format&fit=crop',
];

function formatLabel(modes: ('online' | 'onsite')[]): string {
  const has = new Set(modes);
  if (has.has('onsite') && has.has('online')) return 'Onsite & Online';
  if (has.has('onsite')) return 'Onsite';
  if (has.has('online')) return 'Online';
  return '—';
}

function toPublicCourse(row: ApiPublicCourseRow, index: number): PublicCourse {
  const pass = Number(row.passingAttendancePercent);
  return {
    id: row.id,
    level: row.category ?? 'Course',
    format: formatLabel(row.modes),
    img: row.imageUrl ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    title: row.title,
    desc: row.description ?? 'Details for this course will be shared soon.',
    sessions: String(row.totalSessions),
    offeringsCount: row.offeringsCount,
    pass: `${Number.isInteger(pass) ? pass : pass.toFixed(1)}%`,
    open: row.isOpenForEnrollment ? 'Open for enrollment' : 'New sessions coming soon',
    isOpenForEnrollment: row.isOpenForEnrollment,
  };
}

function toPublicCourseDetail(row: ApiPublicCourseDetailRow): PublicCourseDetail {
  return {
    ...toPublicCourse(row, 0),
    syllabusTopics: (row.syllabus ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

@Injectable({ providedIn: 'root' })
export class PublicCourseApiService {
  private readonly http = inject(HttpClient);

  readonly courses = signal<PublicCourse[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load(): Observable<PublicCourse[]> {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiPublicCourseRow[]>(`${environment.apiUrl}/public/courses`).pipe(
      map((rows) => rows.map(toPublicCourse)),
      tap({
        next: (courses) => {
          this.courses.set(courses);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load courses right now.');
          this.loading.set(false);
        },
      }),
    );
  }

  loadOne(id: string): Observable<PublicCourseDetail> {
    return this.http
      .get<ApiPublicCourseDetailRow>(`${environment.apiUrl}/public/courses/${id}`)
      .pipe(map(toPublicCourseDetail));
  }

  loadOfferings(courseId: string): Observable<PublicOffering[]> {
    return this.http.get<PublicOffering[]>(`${environment.apiUrl}/public/courses/${courseId}/offerings`);
  }

  loadNeeds(courseId: string): Observable<PublicCourseNeed[]> {
    return this.http.get<PublicCourseNeed[]>(`${environment.apiUrl}/public/courses/${courseId}/needs`);
  }

  loadDonations(courseId: string): Observable<PublicDonationRow[]> {
    return this.http.get<PublicDonationRow[]>(`${environment.apiUrl}/public/courses/${courseId}/donations`);
  }

  loadPhotos(courseId: string): Observable<PublicCoursePhoto[]> {
    return this.http.get<PublicCoursePhoto[]>(`${environment.apiUrl}/public/courses/${courseId}/photos`);
  }
}
