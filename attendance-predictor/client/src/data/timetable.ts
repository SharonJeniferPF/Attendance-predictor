export type SubjectDefinition = {
  code: string;
  name: string;
  source?: string;
};

export type SectionDefinition = {
  id: string;
  label: string;
  year: string;
  sourceFile: string;
  subjects: SubjectDefinition[];
  schedule: Record<string, (string | null)[]>;
};

const slot = (code: string, name: string, source?: string): SubjectDefinition => ({ code, name, source });

const coreFirstYear = {
  A: 'Advanced Calculus and Complex Analysis',
  B: 'Chemistry',
  D: 'Programming for Problem Solving',
  E: 'Philosophy of Engineering',
  WORKSHOP: 'Basic Civil and Mechanical Workshop',
  CDC: 'General Aptitude',
  NSS: 'NSS',
};

const coreFirstYearSubjects = (overrides: Partial<Record<keyof typeof coreFirstYear | 'C' | 'F' | 'G' | 'GERMAN' | 'YOGA' | 'JAPANESE', string>> = {}) =>
  Object.entries({
    ...coreFirstYear,
    C: 'Electronic System and PCB Design',
    F: 'Biology',
    GERMAN: 'German',
    ...overrides,
  }).map(([code, name]) => slot(code, name));

const postLunch = null;

export const timetableDataset = {
  meta: {
    semesterStart: '2026-08-29',
    semesterEnd: '2026-11-29',
    threshold75: 0.75,
    threshold90: 0.9,
    holidays: [] as string[],
    sourceFolder: 'https://drive.google.com/drive/folders/178oRX8akrUp6eqASCOQ5FafWfJi2RM4t',
    sourceNote:
      'The source folder contains 10 scanned PDFs. Four first-year section schedules are included in the I year PDF, so the authoritative section count is 13. No holiday calendar was supplied.',
  },
  periods: [
    { number: 1, label: 'P1', start: '09:00', end: '09:50' },
    { number: 2, label: 'P2', start: '09:50', end: '10:40' },
    { number: 3, label: 'P3', start: '10:50', end: '11:40' },
    { number: 4, label: 'P4', start: '11:40', end: '12:30' },
    { number: 5, label: 'P5', start: '12:30', end: '13:20' },
    { number: 6, label: 'P6', start: '13:20', end: '14:10' },
    { number: 7, label: 'P7', start: '14:10', end: '15:00' },
    { number: 8, label: 'P8', start: '15:10', end: '16:00' },
    { number: 9, label: 'P9', start: '16:00', end: '16:50' },
  ],
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  sections: [
    {
      id: 'i-ece-a',
      label: 'I ECE-A',
      year: 'I year',
      sourceFile: 'I year Time Table SEEE.pdf · page 1',
      subjects: coreFirstYearSubjects(),
      schedule: {
        Monday: ['E', 'E', 'B', 'A', postLunch, 'B', 'B', 'F', 'CDC'],
        Tuesday: ['C', 'B', 'A', 'D', postLunch, 'WORKSHOP', 'WORKSHOP', 'WORKSHOP', 'WORKSHOP'],
        Wednesday: ['B', 'E', 'D', postLunch, postLunch, 'D', 'D', 'C', 'C'],
        Thursday: [postLunch, 'GERMAN', 'GERMAN', 'A', postLunch, 'CDC', 'CDC', 'NSS', 'NSS'],
        Friday: ['D', 'A', 'C', 'B', postLunch, 'F', 'GERMAN', 'GERMAN', 'GERMAN'],
      },
    },
    {
      id: 'i-ece-b-eee',
      label: 'I ECE-B / EEE',
      year: 'I year',
      sourceFile: 'I year Time Table SEEE.pdf · page 2',
      subjects: [
        ...coreFirstYearSubjects({ C: 'Biology' }).filter((subject) => subject.code !== 'F'),
        slot('F/G', 'Branch-specific F/G slot: Electronic System and PCB Design (ECE) / Electrical Circuits (EEE)'),
      ],
      schedule: {
        Monday: ['CDC', 'F/G', 'B', 'B', postLunch, 'E', 'E', 'B', 'A'],
        Tuesday: ['WORKSHOP', 'WORKSHOP', 'WORKSHOP', 'WORKSHOP', postLunch, 'C', 'B', 'A', 'D'],
        Wednesday: ['F/G', 'D', 'CDC', 'CDC', 'D', postLunch, 'B', 'E', 'D'],
        Thursday: ['NSS', 'NSS', 'C', 'A', postLunch, 'D', 'GERMAN', 'GERMAN', 'GERMAN'],
        Friday: ['C', 'C', postLunch, 'GERMAN', 'GERMAN', 'GERMAN', postLunch, 'B', 'A'],
      },
    },
    {
      id: 'i-ece-ds',
      label: 'I ECE-DS',
      year: 'I year',
      sourceFile: 'I year Time Table SEEE.pdf · page 3',
      subjects: coreFirstYearSubjects(),
      schedule: {
        Monday: ['F', 'CDC', 'C', 'C', postLunch, 'E', 'E', 'B', 'A'],
        Tuesday: ['B', 'B', 'NSS', 'NSS', postLunch, 'C', 'B', 'A', 'D'],
        Wednesday: ['CDC', 'CDC', 'A', 'D', 'D', 'D', 'B', 'E', 'D'],
        Thursday: ['F', 'A', 'D', 'GERMAN', 'GERMAN', 'GERMAN', postLunch, 'C', 'B'],
        Friday: ['GERMAN', 'GERMAN', 'GERMAN', 'D', postLunch, postLunch, 'WORKSHOP', 'WORKSHOP', 'WORKSHOP'],
      },
    },
    {
      id: 'i-biotech-b',
      label: 'I Biotech-B',
      year: 'I year',
      sourceFile: 'I year Time Table SEEE.pdf · page 4',
      subjects: [
        slot('A', 'Advanced Calculus and Complex Analysis'),
        slot('B', 'Chemistry'),
        slot('C', 'Cell Biology (for Biotech)'),
        slot('D', 'Programming for Problem Solving'),
        slot('E', 'Philosophy of Engineering'),
        slot('F', 'Biochemistry (for Biotech)'),
        slot('G', 'Biology: Human physiology and anatomy (only for Biomedical Engineering)'),
        slot('F/G', 'Source timetable F/G combined slot'),
        slot('C/G', 'Source timetable C/G combined slot'),
        slot('JAPANESE', 'Japanese'),
        slot('WORKSHOP', 'Basic Civil and Mechanical Workshop'),
        slot('CDC', 'General Aptitude'),
        slot('YOGA', 'Physical and Mental Health using Yoga'),
      ],
      schedule: {
        Monday: ['C', 'YOGA', 'YOGA', 'F/G', postLunch, 'E', 'E', 'A', 'B'],
        Tuesday: ['CDC', 'CDC', 'C', 'F', postLunch, postLunch, 'B', 'A', 'D'],
        Wednesday: ['WORKSHOP', 'WORKSHOP', 'WORKSHOP', 'WORKSHOP', postLunch, 'D', 'B', 'E', 'D'],
        Thursday: ['B', 'B', 'A', 'C/G', postLunch, 'B', 'JAPANESE', 'JAPANESE', 'JAPANESE'],
        Friday: ['F', 'CDC', 'A', 'JAPANESE', 'JAPANESE', 'JAPANESE', postLunch, 'D', 'D'],
      },
    },
    {
      id: 'ii-bme',
      label: 'II BME',
      year: 'II year',
      sourceFile: 'II BME.pdf',
      subjects: [
        slot('A', 'Transforms and Boundary Value Problems'),
        slot('B', 'Biomedical Signals and Systems'),
        slot('C', 'Electric and Electronic Circuits'),
        slot('D', 'Digital Logic for Medical Systems'),
        slot('E', 'Medical Physics'),
        slot('F', 'Professional Ethics'),
        slot('G', 'Universal Human Values-II'),
        slot('H', 'Verbal Reasoning'),
        slot('I', 'Social Engineering'),
      ],
      schedule: {
        Monday: ['E', 'C', 'I', 'I', postLunch, 'C', 'C', postLunch, postLunch],
        Tuesday: ['C', 'E', 'B', 'A', postLunch, 'H', 'H', postLunch, postLunch],
        Wednesday: ['B', 'D', 'A', 'A', postLunch, 'H', 'G', postLunch, postLunch],
        Thursday: ['A', 'E', 'B', 'D', postLunch, postLunch, postLunch, 'C', 'C'],
        Friday: ['F', 'A', 'C', 'D', postLunch, postLunch, postLunch, 'G', 'G'],
      },
    },
    {
      id: 'ii-ece-ds-a',
      label: 'II ECE-DS A',
      year: 'II year',
      sourceFile: 'II ECE DS A.pdf',
      subjects: [
        slot('A', 'Transforms and Boundary Value Problems'),
        slot('B', 'Solid State Devices'),
        slot('C', 'Computer Organization and Architecture'),
        slot('D', 'Digital Logic Design'),
        slot('E', 'Electromagnetic Theory and Interference'),
        slot('F', 'Professional Ethics'),
        slot('G', 'Universal Human Values-II'),
        slot('H', 'Verbal Reasoning'),
        slot('I', 'Social Engineering'),
        slot('LAB', 'Devices and Digital IC Laboratory'),
      ],
      schedule: {
        Monday: ['E', 'A', 'I', 'I', postLunch, 'G', 'G', 'LAB', 'LAB'],
        Tuesday: ['C', 'A', 'E', 'D', postLunch, 'G', postLunch, 'H', 'H'],
        Wednesday: ['A', 'B', 'C', 'D', postLunch, postLunch, 'H', postLunch, postLunch],
        Thursday: ['B', 'C', 'A', 'F', postLunch, 'LAB', 'LAB', postLunch, postLunch],
        Friday: ['D', 'B', 'E', 'C', postLunch, postLunch, postLunch, postLunch, postLunch],
      },
    },
    {
      id: 'ii-ece-ds-b',
      label: 'II ECE-DS B',
      year: 'II year',
      sourceFile: 'II ECE DS B.pdf',
      subjects: [
        slot('A', 'Transforms and Boundary Value Problems'),
        slot('B', 'Solid State Devices'),
        slot('C', 'Computer Organization and Architecture'),
        slot('D', 'Digital Logic Design'),
        slot('E', 'Electromagnetic Theory and Interference'),
        slot('F', 'Professional Ethics'),
        slot('G', 'Universal Human Values-II'),
        slot('H', 'Verbal Reasoning'),
        slot('I', 'Social Engineering'),
        slot('LAB', 'Devices and Digital IC Laboratory'),
      ],
      schedule: {
        Monday: [postLunch, postLunch, 'LAB', 'LAB', postLunch, 'D', 'B', 'C', 'I'],
        Tuesday: ['LAB', 'LAB', postLunch, postLunch, postLunch, 'C', 'D', 'E', 'A'],
        Wednesday: ['G', postLunch, postLunch, postLunch, postLunch, 'I', 'E', 'A', 'D'],
        Thursday: ['G', 'G', 'H', 'H', postLunch, 'A', 'C', 'B', 'E'],
        Friday: ['H', postLunch, postLunch, postLunch, postLunch, 'F', 'A', 'B', 'C'],
      },
    },
    {
      id: 'iii-bme',
      label: 'III BME',
      year: 'III year',
      sourceFile: 'III BME.pdf',
      subjects: [
        slot('A', 'Probability and Statistics'),
        slot('B', 'Microcontrollers and Its Application in Medicine'),
        slot('C', 'Biomedical Signal Processing'),
        slot('D', 'Biometrics'),
        slot('E', 'Modern wireless communication system'),
        slot('F', 'Principles of Medical Imaging'),
        slot('G', 'Analytical and Logical Thinking Skills'),
        slot('H', 'Indian Art Form'),
        slot('I', 'Community Connect'),
      ],
      schedule: {
        Monday: ['G', 'G', 'B', 'B', postLunch, 'E', 'B', postLunch, 'F'],
        Tuesday: ['C', 'C', 'G', postLunch, postLunch, 'C', 'D', postLunch, 'A'],
        Wednesday: [postLunch, postLunch, postLunch, postLunch, postLunch, 'C', 'A', postLunch, 'F'],
        Thursday: [postLunch, postLunch, postLunch, 'I', postLunch, 'A', 'C', postLunch, 'E'],
        Friday: ['I', postLunch, postLunch, postLunch, postLunch, 'F', 'A', postLunch, 'D'],
      },
    },
    {
      id: 'iii-ece-a',
      label: 'III ECE-A',
      year: 'III year',
      sourceFile: 'III ECE A.pdf',
      subjects: [
        slot('A', 'Discrete Mathematics'),
        slot('B', 'Microprocessor, Microcontroller, and Interfacing Techniques'),
        slot('C', 'VLSI Design and Technology'),
        slot('D', 'System and Network on Chip'),
        slot('E', 'Machine learning for all'),
        slot('F', 'Community connect'),
        slot('G', 'Analytical and logical thinking skills'),
        slot('H', 'Indian Art Form'),
        slot('LAB', 'VLSI Design / Microprocessor Laboratory'),
      ],
      schedule: {
        Monday: ['E', 'B', 'B', 'A', postLunch, 'G', 'G', postLunch, postLunch],
        Tuesday: ['H', 'D', 'B', 'B', postLunch, postLunch, 'G', postLunch, postLunch],
        Wednesday: ['C', 'A', 'D', 'F', postLunch, postLunch, postLunch, 'LAB', 'LAB'],
        Thursday: ['A', 'E', 'C', 'F', postLunch, postLunch, postLunch, postLunch, postLunch],
        Friday: ['D', 'A', 'E', 'C', postLunch, 'LAB', 'LAB', postLunch, postLunch],
      },
    },
    {
      id: 'iii-ece-b',
      label: 'III ECE-B',
      year: 'III year',
      sourceFile: 'III ECE B.pdf',
      subjects: [
        slot('A', 'Discrete Mathematics'),
        slot('B', 'Microprocessor, Microcontroller, and Interfacing Techniques'),
        slot('C', 'VLSI Design and Technology'),
        slot('D', 'System and Network on Chip'),
        slot('E', 'Machine learning for all'),
        slot('F', 'Community connect'),
        slot('G', 'Analytical and logical thinking skills'),
        slot('H', 'Indian Art Form'),
        slot('LAB', 'VLSI Design / Microprocessor Laboratory'),
      ],
      schedule: {
        Monday: ['LAB', 'LAB', postLunch, postLunch, postLunch, 'E', 'B', postLunch, 'A'],
        Tuesday: ['G', 'G', postLunch, postLunch, postLunch, 'F', 'B', postLunch, 'D'],
        Wednesday: ['G', postLunch, postLunch, postLunch, postLunch, 'B', 'B', postLunch, 'A'],
        Thursday: ['LAB', 'LAB', postLunch, postLunch, postLunch, 'A', 'C', postLunch, 'E'],
        Friday: [postLunch, postLunch, postLunch, postLunch, postLunch, 'C', 'A', postLunch, 'E'],
      },
    },
    {
      id: 'iii-ece-ds',
      label: 'III ECE-DS',
      year: 'III year',
      sourceFile: 'III ECE DS.pdf',
      subjects: [
        slot('A', 'Discrete Mathematics'),
        slot('B', 'Microprocessor, Microcontroller, and Interfacing Techniques'),
        slot('C', 'VLSI Design and Technology'),
        slot('D', 'Machine learning for all'),
        slot('E', 'Database Design and Management'),
        slot('F', 'Community connect'),
        slot('G', 'Analytical and logical thinking skills'),
        slot('H', 'Indian Art Form'),
        slot('LAB', 'VLSI Design / Microprocessor Laboratory'),
      ],
      schedule: {
        Monday: ['E', 'B', 'C', 'A', postLunch, postLunch, postLunch, postLunch, postLunch],
        Tuesday: ['C', 'B', 'D', 'F', postLunch, 'LAB', 'LAB', postLunch, postLunch],
        Wednesday: ['H', 'B', 'A', 'C', postLunch, postLunch, postLunch, postLunch, 'G'],
        Thursday: ['A', 'D', 'E', 'F', postLunch, postLunch, postLunch, postLunch, postLunch],
        Friday: ['D', 'A', 'E', 'B', postLunch, 'G', postLunch, 'LAB', 'LAB'],
      },
    },
    {
      id: 'iv-ece-a',
      label: 'IV ECE-A',
      year: 'IV year',
      sourceFile: 'IV ECE A.pdf',
      subjects: [
        slot('A', 'Behavioural Psychology'),
        slot('B', 'Wireless Communication and Antenna Systems'),
        slot('C', 'Computer Communication and Network Security'),
        slot('D', 'Semiconductor Memory Design'),
        slot('E', 'Scripting Language for Electronic Design Automation'),
        slot('F', 'Machine learning for all'),
        slot('LAB', 'Computer Communication and Network Security Laboratory'),
      ],
      schedule: {
        Monday: ['C', postLunch, 'A', 'D', postLunch, postLunch, postLunch, postLunch, postLunch],
        Tuesday: ['C', 'D', 'B', 'F', postLunch, postLunch, postLunch, postLunch, postLunch],
        Wednesday: ['B', 'LAB', 'E', 'F', postLunch, postLunch, postLunch, postLunch, postLunch],
        Thursday: ['F', 'A', 'E', 'B', postLunch, postLunch, postLunch, postLunch, postLunch],
        Friday: ['C', 'A', 'D', 'E', postLunch, postLunch, postLunch, postLunch, postLunch],
      },
    },
    {
      id: 'iv-ece-b',
      label: 'IV ECE-B',
      year: 'IV year',
      sourceFile: 'IV ECE B.pdf',
      subjects: [
        slot('A', 'Behavioural Psychology'),
        slot('B', 'Wireless Communication and Antenna Systems'),
        slot('C', 'Computer Communication and Network Security'),
        slot('D', 'Semiconductor Memory Design'),
        slot('E', 'Scripting Language for Electronic Design Automation'),
        slot('F', 'Machine learning for all'),
        slot('LAB', 'Computer Communication and Network Security Laboratory'),
      ],
      schedule: {
        Monday: ['C', 'A', 'E', 'F', postLunch, postLunch, postLunch, postLunch, postLunch],
        Tuesday: ['C', 'E', 'F', 'B', postLunch, postLunch, postLunch, postLunch, postLunch],
        Wednesday: ['C', 'D', 'A', 'B', postLunch, postLunch, postLunch, postLunch, postLunch],
        Thursday: ['D', 'B', 'LAB', 'A', postLunch, postLunch, postLunch, postLunch, postLunch],
        Friday: ['E', 'D', 'F', postLunch, postLunch, postLunch, postLunch, postLunch, postLunch],
      },
    },
  ] satisfies SectionDefinition[],
} as const;

export type TimetableDataset = typeof timetableDataset;
