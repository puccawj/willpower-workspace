import { Injectable } from '@angular/core';
import { BranchInfo, Course, InstituteEvent, TeamMember, TimelineEntry } from '../models/willpower.models';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  readonly events: InstituteEvent[] = [
    {
      id: 1, day: '14', mon: 'JUL', img: 'https://images.unsplash.com/photo-1749642955698-ebe5e4579034?q=80&w=1200&auto=format&fit=crop',
      dateFull: 'Monday, July 14, 2026', when: 'upcoming', branch: 'USA', title: 'Morning Meditation Retreat',
      blurb: 'A guided day of silent practice and dhamma reflection.', time: '8:00 AM – 4:00 PM', location: 'Main Hall, Los Angeles',
      capacity: 60, going: 41,
      body1: 'Spend a full day in guided silence, moving through sitting and walking meditation under the direction of our senior teachers. The retreat is suited to both new and returning practitioners.',
      body2: 'A simple vegetarian lunch is provided. Please arrive fifteen minutes early to settle in. Comfortable clothing is recommended.',
    },
    {
      id: 2, day: '22', mon: 'JUL', img: 'https://images.unsplash.com/photo-1716805825299-70bcd837605e?q=80&w=1200&auto=format&fit=crop',
      dateFull: 'Tuesday, July 22, 2026', when: 'upcoming', branch: 'Canada', title: 'Dhamma Talk & Community Meal',
      blurb: 'An evening of teaching, questions, and shared vegetarian food.', time: '6:30 PM – 9:00 PM', location: 'Community Room, Toronto',
      capacity: 80, going: 52,
      body1: 'An open evening of teaching followed by questions and conversation, closing with a shared vegetarian meal prepared by volunteers. All are welcome, regardless of experience.',
      body2: 'This gathering is a wonderful first step for anyone curious about the institute and its community.',
    },
    {
      id: 3, day: '03', mon: 'AUG', img: 'https://images.unsplash.com/photo-1642980522015-7b060e307692?q=80&w=1200&auto=format&fit=crop',
      dateFull: 'Sunday, August 3, 2026', when: 'upcoming', branch: 'Australia', title: 'Foundations of Willpower',
      blurb: "Open lecture introducing the institute's core teaching path.", time: '10:00 AM – 12:00 PM', location: 'Lecture Hall, Sydney',
      capacity: 100, going: 37,
      body1: 'A public lecture introducing the foundations of our teaching path — the cultivation of willpower through steady, patient practice. Ideal preparation for those considering enrolling in a course.',
      body2: 'No registration fee. Seating is limited, so early RSVP is encouraged.',
    },
    {
      id: 4, day: '17', mon: 'AUG', img: 'https://images.unsplash.com/photo-1767327863182-a5395c2db77d?q=80&w=1200&auto=format&fit=crop',
      dateFull: 'Monday, August 17, 2026', when: 'upcoming', branch: 'USA', title: 'Weekend Silent Retreat',
      blurb: 'A two-day residential retreat in the hills outside the city.', time: 'All day', location: 'Retreat Grounds, California',
      capacity: 40, going: 29,
      body1: 'A two-day residential retreat set apart from daily life, with structured silence, guided sessions, and personal interviews with teachers.',
      body2: 'Accommodation and meals are included. Places are limited and often fill quickly.',
    },
    {
      id: 5, day: '29', mon: 'AUG', img: 'https://images.unsplash.com/photo-1685067621157-2b81c84ee073?q=80&w=1200&auto=format&fit=crop',
      dateFull: 'Friday, August 29, 2026', when: 'upcoming', branch: 'Canada', title: 'Youth Mindfulness Evening',
      blurb: 'An introductory session designed for younger practitioners.', time: '5:00 PM – 7:00 PM', location: 'Community Room, Toronto',
      capacity: 50, going: 18,
      body1: 'A relaxed introduction to mindfulness designed for younger practitioners and their families, combining short practice with discussion.',
      body2: 'Free to attend. Guardians are welcome to join.',
    },
    {
      id: 6, day: '20', mon: 'JUN', img: 'https://images.unsplash.com/photo-1736192498500-aa975f93b355?q=80&w=1200&auto=format&fit=crop',
      dateFull: 'Friday, June 20, 2026', when: 'past', branch: 'Australia', title: 'Founders’ Day Ceremony',
      blurb: 'Our annual gathering honouring the institute’s lineage.', time: '9:00 AM – 1:00 PM', location: 'Lecture Hall, Sydney',
      capacity: 120, going: 118,
      body1: 'The annual ceremony honouring the founders and lineage of the institute, with chanting, teaching, and a shared meal.',
      body2: 'Thank you to all who attended this year’s gathering.',
    },
  ];

  readonly courses: Course[] = [
    { level: 'Foundations', format: 'Onsite', img: 'https://images.unsplash.com/photo-1772034292097-447be2dd32ea?q=80&w=1200&auto=format&fit=crop', title: 'Introduction to Meditation', desc: 'Eight sessions covering breath, posture, and the fundamentals of a daily sitting practice for complete beginners.', sessions: '8', hours: '16', pass: '80%', open: 'Open for enrollment' },
    { level: 'Intermediate', format: 'Onsite', img: 'https://images.unsplash.com/photo-1589862607042-7e09233f593b?q=80&w=1200&auto=format&fit=crop', title: 'The Path of Willpower', desc: 'Twelve sessions on concentration, discipline, and applying mindfulness to the ordinary moments of daily life.', sessions: '12', hours: '30', pass: '80%', open: 'Open for enrollment' },
    { level: 'Online', format: 'Online', img: 'https://images.unsplash.com/photo-1505191419261-8ccbb5ac8f93?q=80&w=1200&auto=format&fit=crop', title: 'Contemplative Study Circle', desc: 'A guided online reading course in classical teachings, running live across all three branch time zones.', sessions: '10', hours: '20', pass: '75%', open: 'Open for enrollment' },
    { level: 'Advanced', format: 'Onsite', img: 'https://images.unsplash.com/photo-1566499175117-c78fabf20b7d?q=80&w=1200&auto=format&fit=crop', title: 'Teachers in Training', desc: 'A selective programme for experienced practitioners preparing to guide others, with mentorship and practicum.', sessions: '16', hours: '48', pass: '90%', open: 'Applications open' },
  ];

  readonly team: TeamMember[] = [
    { name: 'Ajahn Suriya', role: 'Director & Senior Teacher', branch: 'USA', img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop&crop=faces' },
    { name: 'Dr. Mala Chen', role: 'Head of Curriculum', branch: 'Canada', img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&auto=format&fit=crop&crop=faces' },
    { name: 'Ven. Ananda', role: 'Resident Teacher', branch: 'Australia', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop&crop=faces' },
    { name: 'Priya Nair', role: 'Instructor', branch: 'USA', img: 'https://images.unsplash.com/photo-1627161683077-e34782c24d81?q=80&w=600&auto=format&fit=crop&crop=faces' },
    { name: 'David Okafor', role: 'Instructor', branch: 'Canada', img: 'https://images.unsplash.com/photo-1629425733761-caae3b5f2e50?q=80&w=600&auto=format&fit=crop&crop=faces' },
    { name: 'Sarah Whitfield', role: 'Community Coordinator', branch: 'Australia', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop&crop=faces' },
  ];

  readonly timeline: TimelineEntry[] = [
    { year: '1932', title: 'The first hall opens', desc: 'The institute is founded as a single meditation hall dedicated to the study of willpower and mind.' },
    { year: '1978', title: 'A teaching lineage takes shape', desc: 'A formal curriculum is established, training the first generation of resident teachers.' },
    { year: '2004', title: 'Crossing continents', desc: 'The first international branch opens, carrying the practice to a new community abroad.' },
    { year: '2019', title: 'Three branches, one practice', desc: 'With centres in the USA, Canada, and Australia, the institute serves students across three continents.' },
  ];

  readonly branches: BranchInfo[] = [
    { name: 'United States', city: 'Los Angeles', img: 'https://images.unsplash.com/photo-1526427158867-98ee4ba58d5a?q=80&w=1200&auto=format&fit=crop', desc: 'Our founding centre, home to the main hall and residential retreat grounds.' },
    { name: 'Canada', city: 'Toronto', img: 'https://images.unsplash.com/photo-1622506092974-38b108ee3436?q=80&w=1200&auto=format&fit=crop', desc: 'A vibrant community centre hosting weekly talks and courses in the heart of the city.' },
    { name: 'Australia', city: 'Sydney', img: 'https://images.unsplash.com/photo-1653997412308-308d945f687b?q=80&w=1200&auto=format&fit=crop', desc: 'Our newest branch, welcoming a growing community of practitioners across the region.' },
  ];

  getEventById(id: number): InstituteEvent | undefined {
    return this.events.find((ev) => ev.id === id);
  }
}
