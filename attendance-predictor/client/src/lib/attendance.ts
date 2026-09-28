import type { SectionDefinition, SubjectDefinition } from '@/data/timetable';

export type AttendanceInput = {
  attended: string;
  conducted: string;
};

export type AttendanceValue = {
  attended: number;
  conducted: number;
};

export type SubjectAnalysis = {
  subject: SubjectDefinition;
  input: AttendanceInput;
  validInput: boolean;
  hasInput: boolean;
  attended: number;
  conducted: number;
  currentPercent: number | null;
  remaining: number;
  maximumPercent: number | null;
  target75: number | null;
  target90: number | null;
  canReach75: boolean | null;
  canReach90: boolean | null;
  canMiss75: number | null;
  planScheduled: number;
  planAttendAllPercent: number | null;
  planMissAllPercent: number | null;
  status: 'safe' | 'attention' | 'high-risk' | 'irreversible' | 'input';
};

export const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number): Date {
  const result = dateOnly(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function clampDate(date: Date, min: Date, max: Date): Date {
  const timestamp = dateOnly(date).getTime();
  return new Date(Math.min(Math.max(timestamp, dateOnly(min).getTime()), dateOnly(max).getTime()));
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function isWithinInclusive(date: Date, start: Date, end: Date) {
  const value = dateOnly(date).getTime();
  return value >= dateOnly(start).getTime() && value <= dateOnly(end).getTime();
}

export function countScheduled(section: SectionDefinition, startDate: Date, endDate: Date, subjectCode?: string) {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (start.getTime() > end.getTime()) return 0;

  let count = 0;
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    const daySchedule = section.schedule[weekdayNames[cursor.getDay()]];
    if (!daySchedule) continue;
    for (const token of daySchedule) {
      if (token && (!subjectCode || token === subjectCode)) count += 1;
    }
  }
  return count;
}

export function parseAttendance(input: AttendanceInput): { valid: boolean; hasInput: boolean; attended: number; conducted: number } {
  const hasInput = input.attended.trim() !== '' || input.conducted.trim() !== '';
  if (!hasInput) return { valid: false, hasInput: false, attended: 0, conducted: 0 };

  const attended = Number(input.attended);
  const conducted = Number(input.conducted);
  const valid = Number.isInteger(attended) && Number.isInteger(conducted) && attended >= 0 && conducted >= 0 && attended <= conducted;
  return { valid, hasInput: true, attended: valid ? attended : 0, conducted: valid ? conducted : 0 };
}

export function minimumAttendances(attended: number, conducted: number, remaining: number, threshold: number) {
  if (conducted + remaining === 0) return 0;
  const needed = Math.ceil(threshold * (conducted + remaining) - attended - 1e-10);
  return Math.max(0, needed);
}

export function projectedPercent(attended: number, conducted: number, futureAttended: number, futureClasses: number) {
  const denominator = conducted + futureClasses;
  return denominator > 0 ? ((attended + futureAttended) / denominator) * 100 : null;
}

export function analyzeSubject(
  section: SectionDefinition,
  subject: SubjectDefinition,
  input: AttendanceInput,
  semesterStart: Date,
  semesterEnd: Date,
  today: Date,
  planDate: Date,
): SubjectAnalysis {
  const parsed = parseAttendance(input);
  const effectiveStart = clampDate(today, semesterStart, semesterEnd);
  const safeRemaining = countScheduled(section, effectiveStart, semesterEnd, subject.code);
  const planEnd = clampDate(planDate, effectiveStart, semesterEnd);
  const planScheduled = countScheduled(section, effectiveStart, planEnd, subject.code);

  if (!parsed.valid) {
    return {
      subject,
      input,
      validInput: false,
      hasInput: parsed.hasInput,
      attended: 0,
      conducted: 0,
      currentPercent: null,
      remaining: safeRemaining,
      maximumPercent: null,
      target75: null,
      target90: null,
      canReach75: null,
      canReach90: null,
      canMiss75: null,
      planScheduled,
      planAttendAllPercent: null,
      planMissAllPercent: null,
      status: 'input',
    };
  }

  const { attended, conducted } = parsed;
  const currentPercent = conducted > 0 ? (attended / conducted) * 100 : null;
  const maximumPercent = projectedPercent(attended, conducted, safeRemaining, safeRemaining);
  const target75 = minimumAttendances(attended, conducted, safeRemaining, 0.75);
  const target90 = minimumAttendances(attended, conducted, safeRemaining, 0.9);
  const canReach75 = target75 <= safeRemaining;
  const canReach90 = target90 <= safeRemaining;
  const canMiss75 = canReach75 ? safeRemaining - target75 : null;
  const planAttendAllPercent = projectedPercent(attended, conducted, planScheduled, planScheduled);
  const planMissAllPercent = projectedPercent(attended, conducted, 0, planScheduled);

  let status: SubjectAnalysis['status'] = 'attention';
  if (!canReach75) status = 'irreversible';
  else if ((currentPercent ?? 0) < 75) status = 'high-risk';
  else if ((currentPercent ?? 0) >= 90) status = 'safe';

  return {
    subject,
    input,
    validInput: true,
    hasInput: true,
    attended,
    conducted,
    currentPercent,
    remaining: safeRemaining,
    maximumPercent,
    target75,
    target90,
    canReach75,
    canReach90,
    canMiss75,
    planScheduled,
    planAttendAllPercent,
    planMissAllPercent,
    status,
  };
}

export function createEmptyAttendance(subjects: SubjectDefinition[]): Record<string, AttendanceInput> {
  return Object.fromEntries(subjects.map((subject) => [subject.code, { attended: '', conducted: '' }]));
}

export function formatPercent(value: number | null, digits = 1) {
  return value === null || Number.isNaN(value) ? '—' : `${value.toFixed(digits)}%`;
}


export type LeavePolicyMode = 'attended' | 'excluded' | 'absent';

export type LeavePolicy = {
  od: LeavePolicyMode;
  medical: LeavePolicyMode;
};

export type LeaveSimulationInput = {
  startDate: Date;
  endDate: Date;
  odDays: number;
  medicalDays: number;
  normalDays: number;
  policy: LeavePolicy;
};

export type LeaveSubjectImpact = {
  subject: SubjectDefinition;
  current: SubjectAnalysis;
  scheduledDuringLeave: number;
  odClasses: number;
  medicalClasses: number;
  normalAbsentClasses: number;
  projectedAttended: number | null;
  projectedConducted: number | null;
  projectedPercent: number | null;
  projectedStatus: SubjectAnalysis['status'];
  canRecover75: boolean | null;
  maximumPossiblePercent: number | null;
  requiredAfterLeave: number | null;
  remainingAfterLeave: number;
};

export type LeaveSimulation = {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  scheduledClasses: number;
  impacts: LeaveSubjectImpact[];
  affectedSubjects: number;
  policy: LeavePolicy;
};

export function normalizeLeaveRange(startDate: Date, endDate: Date, semesterStart: Date, semesterEnd: Date) {
  const start = clampDate(startDate, semesterStart, semesterEnd);
  const end = clampDate(endDate, semesterStart, semesterEnd);
  return start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
}

export function enumerateDates(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  for (let cursor = dateOnly(startDate); cursor.getTime() <= dateOnly(endDate).getTime(); cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

export function getSubjectSchedule(section: SectionDefinition, subjectCode: string, startDate: Date, endDate: Date) {
  const results: { date: Date; periods: number[] }[] = [];
  for (const date of enumerateDates(startDate, endDate)) {
    const daySchedule = section.schedule[weekdayNames[date.getDay()]] ?? [];
    const periods = daySchedule.reduce<number[]>((matches, token, index) => {
      if (token === subjectCode) matches.push(index + 1);
      return matches;
    }, []);
    if (periods.length) results.push({ date, periods });
  }
  return results;
}

export function countScheduledByType(
  section: SectionDefinition,
  subjectCode: string,
  input: LeaveSimulationInput,
) {
  const range = normalizeLeaveRange(input.startDate, input.endDate, input.startDate, input.endDate);
  const dates = enumerateDates(range.start, range.end);
  const odLimit = Math.max(0, Math.floor(input.odDays));
  const medicalLimit = Math.max(0, Math.floor(input.medicalDays));
  const normalLimit = Math.max(0, Math.floor(input.normalDays));
  let odClasses = 0;
  let medicalClasses = 0;
  let normalAbsentClasses = 0;

  dates.forEach((date, index) => {
    const daySchedule = section.schedule[weekdayNames[date.getDay()]] ?? [];
    const classes = daySchedule.filter((token) => token === subjectCode).length;
    if (index < odLimit) {
      odClasses += classes;
    } else if (index < odLimit + medicalLimit) {
      medicalClasses += classes;
    } else if (index < odLimit + medicalLimit + normalLimit) {
      normalAbsentClasses += classes;
    }
  });

  return { odClasses, medicalClasses, normalAbsentClasses };
}

export function simulateLeave(
  section: SectionDefinition,
  analyses: SubjectAnalysis[],
  input: LeaveSimulationInput,
  semesterStart: Date,
  semesterEnd: Date,
  today: Date,
): LeaveSimulation {
  const range = normalizeLeaveRange(input.startDate, input.endDate, semesterStart, semesterEnd);
  const totalDays = enumerateDates(range.start, range.end).length;
  const impacts = analyses.map((current) => {
    if (!current.validInput) {
      return {
        subject: current.subject,
        current,
        scheduledDuringLeave: 0,
        odClasses: 0,
        medicalClasses: 0,
        normalAbsentClasses: 0,
        projectedAttended: null,
        projectedConducted: null,
        projectedPercent: null,
        projectedStatus: 'input' as const,
        canRecover75: null,
        maximumPossiblePercent: null,
        requiredAfterLeave: null,
        remainingAfterLeave: current.remaining,
      };
    }

    const counts = countScheduledByType(section, current.subject.code, { ...input, startDate: range.start, endDate: range.end });
    const scheduledDuringLeave = counts.odClasses + counts.medicalClasses + counts.normalAbsentClasses;
    const odMode = input.policy.od;
    const medicalMode = input.policy.medical;
    const attendedAdd = (odMode === 'attended' ? counts.odClasses : 0) + (medicalMode === 'attended' ? counts.medicalClasses : 0);
    const conductedAdd = (odMode === 'excluded' ? 0 : counts.odClasses) + (medicalMode === 'excluded' ? 0 : counts.medicalClasses) + counts.normalAbsentClasses;
    const projectedAttended = current.attended + attendedAdd;
    const projectedConducted = current.conducted + conductedAdd;
    const projectedPercent = projectedConducted > 0 ? (projectedAttended / projectedConducted) * 100 : null;
    const remainingAfterLeave = Math.max(0, current.remaining - scheduledDuringLeave);
    const targetAfterLeave = minimumAttendances(projectedAttended, projectedConducted, remainingAfterLeave, 0.75);
    const canRecover75 = targetAfterLeave <= remainingAfterLeave;
    const maximumPossiblePercent = projectedPercentValue(projectedAttended, projectedConducted, remainingAfterLeave, remainingAfterLeave);
    const projectedStatus: SubjectAnalysis['status'] = !canRecover75
      ? 'irreversible'
      : (projectedPercent ?? 0) >= 90
        ? 'safe'
        : (projectedPercent ?? 0) >= 75
          ? 'attention'
          : 'high-risk';

    return {
      subject: current.subject,
      current,
      scheduledDuringLeave,
      odClasses: counts.odClasses,
      medicalClasses: counts.medicalClasses,
      normalAbsentClasses: counts.normalAbsentClasses,
      projectedAttended,
      projectedConducted,
      projectedPercent,
      projectedStatus,
      canRecover75,
      maximumPossiblePercent,
      requiredAfterLeave: canRecover75 ? targetAfterLeave : null,
      remainingAfterLeave,
    };
  });

  return {
    startDate: range.start,
    endDate: range.end,
    totalDays,
    scheduledClasses: impacts.reduce((total, impact) => total + impact.scheduledDuringLeave, 0),
    impacts,
    affectedSubjects: impacts.filter((impact) => impact.scheduledDuringLeave > 0).length,
    policy: input.policy,
  };
}

function projectedPercentValue(attended: number, conducted: number, futureAttended: number, futureClasses: number) {
  const denominator = conducted + futureClasses;
  return denominator > 0 ? ((attended + futureAttended) / denominator) * 100 : null;
}

export function aggregateHealth(analyses: SubjectAnalysis[]) {
  const valid = analyses.filter((analysis) => analysis.validInput);
  const attended = valid.reduce((sum, analysis) => sum + analysis.attended, 0);
  const conducted = valid.reduce((sum, analysis) => sum + analysis.conducted, 0);
  const absent = Math.max(0, conducted - attended);
  const remaining = valid.reduce((sum, analysis) => sum + analysis.remaining, 0);
  const required75 = valid.reduce((sum, analysis) => sum + (analysis.target75 ?? 0), 0);
  const required90 = valid.reduce((sum, analysis) => sum + (analysis.target90 ?? 0), 0);
  return {
    attended,
    conducted,
    absent,
    remaining,
    required75,
    required90,
    percent: conducted > 0 ? (attended / conducted) * 100 : null,
    validSubjects: valid.length,
  };
}

export function formatLeavePolicy(mode: LeavePolicyMode) {
  return mode === 'attended' ? 'counts as attended' : mode === 'excluded' ? 'excluded from denominator' : 'counts as absent';
}
