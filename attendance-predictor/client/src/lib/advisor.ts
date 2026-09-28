import type { SectionDefinition } from '@/data/timetable';
import { addDays, aggregateHealth, formatDate, formatLeavePolicy, formatPercent, simulateLeave, type LeavePolicy, type LeaveSimulation, type SubjectAnalysis } from './attendance';

function subjectMatch(query: string, analyses: SubjectAnalysis[]) {
  const normalized = query.toLowerCase();
  return analyses.find((analysis) => normalized.includes(analysis.subject.name.toLowerCase()))
    ?? analyses.find((analysis) => analysis.subject.code.length > 1 && normalized.includes(analysis.subject.code.toLowerCase()))
    ?? analyses.find((analysis) => {
      const firstWord = analysis.subject.name.split(' ')[0].toLowerCase();
      return firstWord.length > 3 && normalized.includes(firstWord);
    })
    ?? (normalized.includes('math') || normalized.includes('calculus')
      ? analyses.find((analysis) => /math|calculus|probability/i.test(analysis.subject.name))
      : undefined);
}

function riskSubject(analyses: SubjectAnalysis[]) {
  return analyses
    .filter((analysis) => analysis.validInput)
    .sort((a, b) => (a.currentPercent ?? 0) - (b.currentPercent ?? 0))[0];
}

export function answerAttendanceQuestion(
  query: string,
  context: {
    section: SectionDefinition;
    analyses: SubjectAnalysis[];
    leaveSimulation: LeaveSimulation | null;
    today: Date;
    semesterStart: Date;
    semesterEnd: Date;
    defaultLeavePolicy: LeavePolicy;
  },
) {
  const normalized = query.trim().toLowerCase();
  const health = aggregateHealth(context.analyses);
  const subject = subjectMatch(normalized, context.analyses) ?? riskSubject(context.analyses);

  if (!normalized) return 'Ask me about a subject, your 75% runway, 90% target, remaining classes, or the active leave simulation.';
  if (!health.validSubjects) return 'I can answer as soon as you enter at least one valid attended / conducted total in the subject cards. I will use those live numbers and the timetable, not an estimate.';

  if (normalized.includes('closest') || normalized.includes('detention') || normalized.includes('lowest')) {
    if (!subject) return 'No subject has a valid attendance record yet.';
    return `${subject.subject.name} is currently closest to detention at ${formatPercent(subject.currentPercent)}. ${subject.canReach75 ? `You need ${subject.target75} of the ${subject.remaining} remaining timetable classes to finish at or above 75%.` : '75% is mathematically impossible with the remaining timetable classes.'}`;
  }

  if (normalized.includes('attend every') || normalized.includes('final attendance') || normalized.includes('maximum')) {
    if (subject) return `If you attend every remaining ${subject.subject.name} class, the maximum possible final attendance is ${formatPercent(subject.maximumPercent)}.`;
    return `Across the subjects with valid inputs, you have ${health.remaining} remaining timetable classes. Enter a subject name for its exact maximum final attendance.`;
  }

  if (normalized.includes('90')) {
    if (subject) return subject.canReach90 ? `For ${subject.subject.name}, you need to attend ${subject.target90} of the ${subject.remaining} remaining classes to reach 90%.` : `For ${subject.subject.name}, 90% is not reachable from the current record and timetable. The 75% floor is ${subject.canReach75 ? 'still recoverable' : 'also not recoverable'}.`;
    return `The dashboard has ${health.required90} required attendances summed across valid subjects for their 90% targets. Ask with a subject name for a subject-specific answer.`;
  }

  if (normalized.includes('leave') || normalized.includes('sick') || normalized.includes('od') || normalized.includes('medical')) {
    const dayMatch = normalized.match(/(\d+)\s*[- ]?day/);
    const requestedDays = dayMatch ? Math.max(1, Number(dayMatch[1])) : 0;
    let leaveSimulation = context.leaveSimulation;
    let generatedFromQuestion = false;
    if (requestedDays) {
      const startDate = normalized.includes('tomorrow') ? addDays(context.today, 1) : context.today;
      const leaveType = normalized.includes('od') ? 'od' : normalized.includes('sick') || normalized.includes('medical') ? 'medical' : 'normal';
      leaveSimulation = simulateLeave(
        context.section,
        context.analyses,
        {
          startDate,
          endDate: addDays(startDate, requestedDays - 1),
          odDays: leaveType === 'od' ? requestedDays : 0,
          medicalDays: leaveType === 'medical' ? requestedDays : 0,
          normalDays: leaveType === 'normal' ? requestedDays : 0,
          policy: context.defaultLeavePolicy,
        },
        context.semesterStart,
        context.semesterEnd,
        context.today,
      );
      generatedFromQuestion = true;
    }
    if (!leaveSimulation) return 'Configure the OD & Leave Simulator first, or ask with a duration such as “If I take a 3-day sick leave starting tomorrow…”. I will then read exact timetable periods.';
    const affected = leaveSimulation.impacts.filter((impact) => impact.scheduledDuringLeave > 0);
    if (!affected.length) return `No selected subject has a timetable class in the active ${leaveSimulation.totalDays}-day leave window. Weekends and blank timetable cells do not count as classes.`;
    const chosen = subject ? leaveSimulation.impacts.find((impact) => impact.subject.code === subject.subject.code) : affected[0];
    if (!chosen || chosen.projectedPercent === null) return 'The selected subject needs a valid current attendance record before I can project leave impact.';
    const leaveType = chosen.odClasses ? `OD (${formatLeavePolicy(leaveSimulation.policy.od)})` : chosen.medicalClasses ? `medical leave (${formatLeavePolicy(leaveSimulation.policy.medical)})` : 'normal absence';
    const generatedPrefix = generatedFromQuestion ? `From ${formatDate(leaveSimulation.startDate)} to ${formatDate(leaveSimulation.endDate)}, ` : '';
    return `${generatedPrefix}${chosen.subject.name} has ${chosen.scheduledDuringLeave} timetable class${chosen.scheduledDuringLeave === 1 ? '' : 'es'} in the leave window. With ${leaveType}, projected attendance is ${formatPercent(chosen.projectedPercent)}. ${chosen.projectedPercent < 75 ? (chosen.canRecover75 ? `It can still recover by attending ${chosen.requiredAfterLeave} of the ${chosen.remainingAfterLeave} later classes.` : '75% is not recoverable from the remaining timetable.') : 'It remains at or above 75% in this scenario.'}`;
  }

  if (normalized.includes('recover') || normalized.includes('maintain') || normalized.includes('75') || normalized.includes('miss')) {
    if (!subject) return 'Name a subject and I will calculate the exact 75% runway.';
    if (normalized.includes('miss')) return subject.canMiss75 === null ? `${subject.subject.name} has no remaining miss margin if you want to finish at 75%.` : `You can miss ${subject.canMiss75} more ${subject.canMiss75 === 1 ? 'class' : 'classes'} in ${subject.subject.name} and still finish at or above 75%, assuming the timetable and current record stay as entered.`;
    return subject.canReach75 ? `For ${subject.subject.name}, attend ${subject.target75} of the ${subject.remaining} remaining classes to finish at or above 75%.` : `For ${subject.subject.name}, 75% cannot be recovered with the remaining timetable classes.`;
  }

  return `I’m reading ${context.section.label} and ${health.validSubjects} valid subject record${health.validSubjects === 1 ? '' : 's'}. Try: “How many classes can I miss in ${subject?.subject.name ?? 'Chemistry'}?”, “Can I reach 90%?”, or “What happens if I take OD?”`;
}
