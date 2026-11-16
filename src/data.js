export const demoUsers = [
  { id: 'STU001', password: 'student123', role: 'student', name: 'Sam Taylor' },
  { id: 'LEC001', password: 'lecturer123', role: 'lecturer', name: 'Alex Morgan' },
  { id: 'ADMIN001', password: 'admin123', role: 'admin', name: 'Jordan Lee' },
]

const toPublicUser = ({ id, role, name }) => ({ id, role, name })

export const subjects = ['Foundation Period', 'English', 'Maths', 'Physics']
export const semesters = ['Semester 1', 'Semester 2']

export const initialData = {
  lecture_notes: [
    { id: 'n1', title: 'Foundations & Site Preparation', subject: 'Foundation Period', semester: 'Semester 1', description: 'Site investigation, soil types, and setting out.', uploaded_at: '2026-11-12', uploaded_by: 'Alex Morgan', file_data: '' },
    { id: 'n2', title: 'Technical Reading Basics', subject: 'English', semester: 'Semester 1', description: 'Reading technical briefs, reports, and construction vocabulary.', uploaded_at: '2026-11-11', uploaded_by: 'Alex Morgan', file_data: '' },
    { id: 'n3', title: 'Measurement & Scale', subject: 'Maths', semester: 'Semester 1', description: 'Units, conversions, ratios, and working with scale drawings.', uploaded_at: '2026-11-10', uploaded_by: 'Alex Morgan', file_data: '' },
    { id: 'n4', title: 'Forces in Structures', subject: 'Physics', semester: 'Semester 1', description: 'An introduction to forces, loads, and equilibrium.', uploaded_at: '2026-11-09', uploaded_by: 'Alex Morgan', file_data: '' },
    { id: 'n5', title: 'Building Science Review', subject: 'Foundation Period', semester: 'Semester 2', description: 'Review notes for the second semester foundation period.', uploaded_at: '2026-11-08', uploaded_by: 'Alex Morgan', file_data: '' },
  ],
  assignments: [
    { id: 'a1', title: 'Site analysis report', subject: 'Foundation Period', due_date: '2026-11-22', status: 'Not started', type: 'assignment' },
    { id: 'a2', title: 'Technical vocabulary worksheet', subject: 'English', due_date: '2026-11-25', status: 'Not started', type: 'assignment' },
  ],
  assignment_information: [],
  quizzes: [
    { id: 'q1', title: 'Materials knowledge check', subject: 'Physics', due_date: '2026-11-25', status: 'Not started', type: 'quiz', duration_minutes: 15, question: 'Which material is most commonly used to reinforce concrete?', options: ['Timber', 'Steel rebar', 'Clay brick', 'Gypsum board'] },
  ],
  zoom_meetings: [
    { id: 'z1', title: 'Foundation Period — Q&A', meeting_date: '2026-11-18T10:00:00', join_url: 'https://zoom.us/' },
    { id: 'z2', title: 'Maths support class', meeting_date: '2026-11-20T14:30:00', join_url: 'https://zoom.us/' },
  ],
  deadlines: [
    { id: 'd1', title: 'Site analysis report', due_date: '2026-11-22', course: 'Foundation Period', assignment_id: 'a1' },
    { id: 'd2', title: 'Technical vocabulary worksheet', due_date: '2026-11-25', course: 'English', assignment_id: 'a2' },
    { id: 'd3', title: 'Materials knowledge check', due_date: '2026-11-25', course: 'Physics', assignment_id: 'q1' },
  ],
  student_notes: [],
  diary: [],
  users: demoUsers.map(toPublicUser),
  students: demoUsers.filter((item) => item.role === 'student').map(toPublicUser),
  announcements: [],
}
