export type Role = 'superadmin' | 'admin' | 'instructor';
export type Branch = 'USA' | 'Canada' | 'Australia';
export type ViewMode = 'table' | 'card';

export type EventStatus = 'Draft' | 'Scheduled' | 'Published' | 'Ongoing' | 'Closed' | 'Cancelled';

export interface AdminEvent {
  id: number;
  title: string;
  branch: Branch;
  location: string;
  dateFull: string;
  dateShort: string;
  capacity: number;
  going: number;
  maybe: number;
  cancel: number;
  waitlist: number;
  status: EventStatus;
}

export type RsvpStatus = 'confirm' | 'maybe' | 'cancel';

export interface Attendee {
  id: string;
  name: string;
  rsvp: RsvpStatus;
}

export type DonationType = 'Money' | 'Goods';
export type DonationStatus = 'pending' | 'received' | 'verified' | 'rejected';

export interface Donation {
  id: string;
  donor: string;
  anon: boolean;
  type: DonationType;
  amount: string;
  branch: Branch;
  event: string;
  certNo: string | null;
}

export type UserRole = 'Student' | 'Instructor' | 'Admin';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface AdminUser {
  id: string;
  name: string;
  role: UserRole;
  branch: Branch;
  email: string;
}

export interface BranchInfo {
  key: string;
  name: string;
  city: string;
  adminCount: number;
  userCount: number;
  eventCount: number;
}

export interface Course {
  title: string;
  category: string;
  sessions: number;
  hours: number;
  pass: string;
  status: string;
}

export type OfferingMode = 'Onsite' | 'Online';
export type OfferingStatus = 'Draft' | 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';

export interface Offering {
  course: string;
  branch: Branch;
  instructor: string;
  dates: string;
  capacity: number;
  enrolled: number;
  mode: OfferingMode;
  status: OfferingStatus;
}

export type SessionStatus = 'done' | 'today' | 'upcoming';

export interface ClassSession {
  day: string;
  mon: string;
  topic: string;
  time: string;
  location: string;
  status: SessionStatus;
}

export interface Enrollment {
  id: string;
  name: string;
  enrolledDate: string;
  pct: number;
}

export interface CertStudent {
  id: string;
  name: string;
  pct: number;
  certNo: string;
}

export interface FieldPosition {
  xPct: number;
  yPct: number;
}

export interface CertTemplate {
  id: string;
  name: string;
  type: string;
  year: string;
  bg: string;
  bgImage?: string;
  sampleNo: string;
  fieldPositions?: Record<'kicker' | 'name' | 'course' | 'certNo' | 'issueDate', FieldPosition>;
}

export interface TeamMember {
  name: string;
  role: string;
  branch: Branch;
  shown: 'Yes' | 'No';
}

export type EntityType =
  | 'event'
  | 'donation'
  | 'user'
  | 'branch'
  | 'course'
  | 'offering'
  | 'team'
  | 'template';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'image'
  | 'date'
  | 'datetime'
  | 'phone'
  | 'combobox'
  | 'timezone'
  | 'email'
  | 'password'
  | 'multiselect';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** For type 'phone': the values-key that stores the dial code (e.g. 'phoneCountryCode'). `key` stores the number itself. */
  countryKey?: string;
  /** For type 'combobox': another field's key whose current value narrows this field's options (e.g. city depends on country). */
  dependsOn?: string;
  /** Optional helper text rendered below the label. */
  hint?: string;
  /** For type 'multiselect': label of a "select all" checkbox shown above the option list (e.g. 'All Branches'). */
  selectAllLabel?: string;
  /** Renders the input locked/uneditable (e.g. email after account creation). */
  readonly?: boolean;
  /** For type 'number': the HTML `min` attribute (e.g. 0 to disallow negative quantities). */
  min?: number;
}
