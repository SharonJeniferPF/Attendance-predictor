import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  HeartPulse,
  MessageCircle,
  Send,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { timetableDataset, type SectionDefinition, type SubjectDefinition } from '@/data/timetable';
import {
  addDays,
  analyzeSubject,
  aggregateHealth,
  clampDate,
  countScheduled,
  createEmptyAttendance,
  dateOnly,
  formatDate,
  formatPercent,
  parseLocalDate,
  simulateLeave,
  type LeavePolicy,
  type LeaveSimulation,
  type AttendanceInput,
  type SubjectAnalysis,
  toDateKey,
} from '@/lib/attendance';
import { answerAttendanceQuestion } from '@/lib/advisor';
import AttendanceTimeMachine from '@/components/AttendanceTimeMachine';

const statusMeta = {
  safe: {
    label: 'SAFE',
    eyebrow: 'Above the 90% buffer',
    className: 'status-safe',
    icon: ShieldCheck,
  },
  attention: {
    label: 'ON TRACK',
    eyebrow: 'Keep the 75% floor in view',
    className: 'status-attention',
    icon: Check,
  },
  'high-risk': {
    label: 'HIGH RISK',
    eyebrow: 'Recovery is still possible',
    className: 'status-high-risk',
    icon: AlertTriangle,
  },
  irreversible: {
    label: 'IRREVERSIBLE',
    eyebrow: '75% cannot be recovered this term',
    className: 'status-irreversible',
    icon: AlertTriangle,
  },
  input: {
    label: 'INPUT NEEDED',
    eyebrow: 'Enter attended and conducted totals',
    className: 'status-input',
    icon: CircleHelp,
  },
} as const;

const weekdayShort: Record<string, string> = {
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
};

function ProgressBar({ value, tone = 'lime' }: { value: number | null; tone?: 'lime' | 'coral' }) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="progress-track" aria-hidden="true">
      <div className={`progress-fill progress-${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function StatusPill({ status }: { status: keyof typeof statusMeta }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={`status-pill ${meta.className}`}>
      <Icon size={13} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? 'metric-accent' : ''}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}) {
  return (
    <label className={`number-field ${error ? 'field-error' : ''}`}>
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </label>
  );
}

function SubjectCard({ analysis, onUpdate }: { analysis: SubjectAnalysis; onUpdate: (field: keyof AttendanceInput, value: string) => void }) {
  const meta = statusMeta[analysis.status];
  const currentLabel = analysis.currentPercent === null ? '—' : formatPercent(analysis.currentPercent);
  const inputError = analysis.hasInput && !analysis.validInput;
  const planDateCopy = analysis.planScheduled === 1 ? '1 class' : `${analysis.planScheduled} classes`;

  return (
    <article className={`subject-card ${analysis.status === 'irreversible' ? 'card-critical' : ''}`}>
      <div className="subject-card-topline">
        <div className="subject-heading">
          <div className="subject-code">{analysis.subject.code}</div>
          <div>
            <h3>{analysis.subject.name}</h3>
            <p>{meta.eyebrow}</p>
          </div>
        </div>
        <StatusPill status={analysis.status} />
      </div>

      <div className="subject-body">
        <div className="attendance-entry">
          <div className="entry-heading">
            <span className="mini-label">Current record</span>
            <span className="entry-helper">Use totals from your attendance portal</span>
          </div>
          <div className="input-pair">
            <Field label="Attended" value={analysis.input.attended} onChange={(value) => onUpdate('attended', value)} error={inputError} />
            <div className="slash">/</div>
            <Field label="Conducted" value={analysis.input.conducted} onChange={(value) => onUpdate('conducted', value)} error={inputError} />
          </div>
          <div className="entry-status-line">
            {inputError ? (
              <span className="validation-message">Attended must be a whole number between 0 and conducted.</span>
            ) : (
              <span>{analysis.validInput ? `${analysis.attended} present across ${analysis.conducted} conducted` : 'No current total entered yet'}</span>
            )}
          </div>
        </div>

        <div className="current-rate">
          <div className="current-rate-heading">
            <span className="mini-label">Current attendance</span>
            <strong>{currentLabel}</strong>
          </div>
          <ProgressBar value={analysis.currentPercent} tone={analysis.status === 'irreversible' ? 'coral' : 'lime'} />
          <div className="threshold-line">
            <span>75% minimum</span>
            <span>90% safe buffer</span>
          </div>
        </div>
      </div>

      {analysis.validInput ? (
        <>
          <div className="metric-grid">
            <Metric
              label="To stay above 75%"
              value={analysis.canReach75 ? `${analysis.target75} to attend` : 'Not reachable'}
              detail={`${analysis.remaining} classes remain in timetable`}
              accent={analysis.canReach75 === true}
            />
            <Metric
              label="Can miss and still hit 75%"
              value={analysis.canMiss75 === null ? 'No margin' : `${analysis.canMiss75} ${analysis.canMiss75 === 1 ? 'class' : 'classes'}`}
              detail={analysis.canMiss75 === null ? 'Attend every remaining class' : 'Based on every scheduled period'}
            />
            <Metric
              label="90% safe buffer"
              value={analysis.canReach90 ? `${analysis.target90} to attend` : 'Not reachable'}
              detail={analysis.canReach90 ? 'Optional buffer, not the minimum' : '75% is the active floor'}
            />
            <Metric label="Best possible finish" value={formatPercent(analysis.maximumPercent)} detail="If present for every remaining class" />
          </div>

          <div className="forecast-strip">
            <div className="forecast-label">
              <CalendarDays size={15} />
              <span>By your plan date</span>
            </div>
            <span className="forecast-count">{planDateCopy} on the timetable</span>
            <div className="forecast-values">
              <span>
                Attend all <strong>{formatPercent(analysis.planAttendAllPercent)}</strong>
              </span>
              <span className="forecast-divider" />
              <span>
                Miss all <strong className={analysis.planMissAllPercent !== null && analysis.planMissAllPercent < 75 ? 'forecast-danger' : ''}>{formatPercent(analysis.planMissAllPercent)}</strong>
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-calculation">
          <CircleHelp size={17} />
          <div>
            <strong>Enter your current attended / conducted totals</strong>
            <span>Forecasts will appear here without changing the timetable dataset.</span>
          </div>
        </div>
      )}
    </article>
  );
}

function SchedulePreview({ section }: { section: SectionDefinition }) {
  const previewDays = timetableDataset.weekdays;
  return (
    <div className="schedule-preview">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">Weekly rhythm</span>
          <h2>What this timetable actually counts</h2>
        </div>
        <span className="period-count"><Clock3 size={14} /> 9 periods / day</span>
      </div>
      <div className="week-grid">
        {previewDays.map((day) => {
          const classes = section.schedule[day].filter(Boolean);
          return (
            <div className="week-day" key={day}>
              <span>{weekdayShort[day]}</span>
              <strong>{classes.length}</strong>
              <small>{classes.length === 1 ? 'class' : 'classes'}</small>
              <div className="day-dots">
                {section.schedule[day].map((token, index) => (
                  <i className={token ? 'dot-active' : ''} key={`${day}-${index}`} title={token || 'Break'} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="schedule-caption">Break cells and the lunch period are excluded. Merged lab cells are expanded into their occupied timetable periods.</p>
    </div>
  );
}

function AttendanceHealth({ analyses }: { analyses: SubjectAnalysis[] }) {
  const health = aggregateHealth(analyses);
  const ringPercent = health.percent ?? 0;
  const validAnalyses = analyses.filter((analysis) => analysis.validInput);
  return (
    <section className="phase2-section health-section" id="health">
      <div className="phase2-heading">
        <div>
          <div className="section-kicker">03 / Attendance health</div>
          <h2>See the shape of your semester.</h2>
          <p>Every visual below updates from the same subject totals and timetable runway used by the calculator.</p>
        </div>
        <div className="health-source"><HeartPulse size={15} /> Live from your inputs</div>
      </div>
      <div className="health-grid">
        <div className="health-overall-card">
          <div className="donut" style={{ '--donut-progress': `${ringPercent}%` } as CSSProperties}>
            <div className="donut-center"><strong>{health.percent === null ? '—' : formatPercent(health.percent)}</strong><span>overall</span></div>
          </div>
          <div className="health-overall-copy">
            <span className="mini-label">Weighted attendance</span>
            <strong>{health.validSubjects ? `${health.attended} of ${health.conducted} classes attended` : 'Add your subject totals'}</strong>
            <span>{health.validSubjects ? `${health.absent} absent · ${health.remaining} timetable classes left` : 'The overall ring appears once at least one subject is valid.'}</span>
          </div>
        </div>
        <div className="health-metrics">
          <Metric label="Attended" value={String(health.attended)} detail="Classes present" accent />
          <Metric label="Absent" value={String(health.absent)} detail="Classes missed" />
          <Metric label="To maintain 75%" value={health.validSubjects ? String(health.required75) : '—'} detail="Required future attendances" />
          <Metric label="To reach 90%" value={health.validSubjects ? String(health.required90) : '—'} detail="Optional safe buffer" />
        </div>
      </div>
      <div className="bar-chart-card">
        <div className="chart-heading"><span className="mini-label">Subject comparison</span><span className="chart-legend"><i className="legend-safe" /> 90% <i className="legend-floor" /> 75% floor</span></div>
        <div className="subject-bars">
          {validAnalyses.length ? validAnalyses.map((analysis) => {
            const percent = analysis.currentPercent ?? 0;
            const tone = analysis.status === 'safe' ? 'bar-safe' : analysis.status === 'irreversible' || analysis.status === 'high-risk' ? 'bar-danger' : 'bar-warning';
            return <div className="subject-bar-row" key={analysis.subject.code}>
              <span className="bar-label" title={analysis.subject.name}>{analysis.subject.code}</span>
              <div className="bar-track"><div className={`bar-fill ${tone}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /><span className="bar-floor" /><span className="bar-safe-line" /></div>
              <strong>{formatPercent(analysis.currentPercent)}</strong>
            </div>;
          }) : <div className="chart-empty"><CircleHelp size={16} /> Enter attended / conducted totals to populate the subject health chart.</div>}
        </div>
      </div>
    </section>
  );
}

type LeaveFormState = {
  startDate: string;
  endDate: string;
  odDays: string;
  medicalDays: string;
  normalDays: string;
  policy: LeavePolicy;
};

function LeaveSimulator({
  section,
  analyses,
  form,
  setForm,
  simulation,
}: {
  section: SectionDefinition;
  analyses: SubjectAnalysis[];
  form: LeaveFormState;
  setForm: Dispatch<SetStateAction<LeaveFormState>>;
  simulation: LeaveSimulation;
}) {
  const affected = simulation.impacts.filter((impact) => impact.scheduledDuringLeave > 0 && impact.current.validInput);
  const totalLeaveDays = Number(form.odDays || 0) + Number(form.medicalDays || 0) + Number(form.normalDays || 0);
  return (
    <section className="phase2-section leave-section" id="leave">
      <div className="phase2-heading">
        <div>
          <div className="section-kicker">04 / OD & leave simulator</div>
          <h2>Stress-test the days you might miss.</h2>
          <p>Leave impact is counted against actual subject periods in the selected date window — never against calendar days alone.</p>
        </div>
        <div className="health-source"><Stethoscope size={15} /> Policy is configurable</div>
      </div>
      <div className="leave-panel">
        <div className="leave-controls">
          <label className="compact-field"><span>Start date</span><input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label className="compact-field"><span>End date</span><input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <label className="compact-field"><span>OD days</span><input type="number" min="0" step="1" value={form.odDays} onChange={(event) => setForm((current) => ({ ...current, odDays: event.target.value }))} /></label>
          <label className="compact-field"><span>Medical days</span><input type="number" min="0" step="1" value={form.medicalDays} onChange={(event) => setForm((current) => ({ ...current, medicalDays: event.target.value }))} /></label>
          <label className="compact-field"><span>Normal absence days</span><input type="number" min="0" step="1" value={form.normalDays} onChange={(event) => setForm((current) => ({ ...current, normalDays: event.target.value }))} /></label>
        </div>
        <div className="policy-row">
          <span className="mini-label">Treatment assumption</span>
          <label><span>OD</span><select value={form.policy.od} onChange={(event) => setForm((current) => ({ ...current, policy: { ...current.policy, od: event.target.value as LeavePolicy['od'] } }))}><option value="excluded">Exclude from denominator</option><option value="attended">Count as attended</option><option value="absent">Count as absent</option></select></label>
          <label><span>Medical</span><select value={form.policy.medical} onChange={(event) => setForm((current) => ({ ...current, policy: { ...current.policy, medical: event.target.value as LeavePolicy['medical'] } }))}><option value="excluded">Exclude from denominator</option><option value="attended">Count as attended</option><option value="absent">Count as absent</option></select></label>
          <span className="policy-note">The institution’s exact policy was not supplied, so the simulator does not invent one. {totalLeaveDays ? `${totalLeaveDays} leave days configured.` : 'Add leave days to activate the comparison.'}</span>
        </div>
        <div className="leave-summary-strip"><strong>{simulation.scheduledClasses}</strong><span>timetable classes in this window</span><strong>{simulation.affectedSubjects}</strong><span>subjects affected</span><span className="leave-window-copy">{formatDate(simulation.startDate)} → {formatDate(simulation.endDate)}</span></div>
        <div className="leave-results">
          <div className="leave-results-heading"><span className="mini-label">Before → after leave</span><span className="chart-legend"><i className="legend-safe" /> projected attendance</span></div>
          {affected.length ? affected.map((impact) => (
            <div className="leave-row" key={impact.subject.code}>
              <div className="leave-subject"><strong>{impact.subject.code}</strong><span>{impact.subject.name}</span></div>
              <div className="leave-counts"><span className="leave-tag tag-od">OD {impact.odClasses}</span><span className="leave-tag tag-medical">MED {impact.medicalClasses}</span><span className="leave-tag tag-normal">ABS {impact.normalAbsentClasses}</span></div>
              <div className="leave-before-after"><strong>{formatPercent(impact.current.currentPercent)}</strong><ArrowUpRight size={13} /><strong className={impact.projectedPercent !== null && impact.projectedPercent < 75 ? 'forecast-danger' : ''}>{formatPercent(impact.projectedPercent)}</strong></div>
              <div className="leave-recovery">{impact.projectedPercent !== null && impact.projectedPercent < 75 ? (impact.canRecover75 ? `Recover with ${impact.requiredAfterLeave} later classes` : '75% not recoverable') : 'Stays at or above 75%'}</div>
            </div>
          )) : <div className="chart-empty"><CalendarDays size={16} /> No valid subject has a scheduled class in this leave window yet.</div>}
        </div>
      </div>
    </section>
  );
}

function AttendanceAdvisor({ section, analyses, simulation, today, semesterStart, semesterEnd, defaultLeavePolicy }: { section: SectionDefinition; analyses: SubjectAnalysis[]; simulation: LeaveSimulation | null; today: Date; semesterStart: Date; semesterEnd: Date; defaultLeavePolicy: LeavePolicy }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'assistant' | 'user'; text: string }[]>([
    { role: 'assistant', text: 'I’m reading your current dashboard state. Ask me about 75%, 90%, remaining classes, a subject, or the active leave simulation.' },
  ]);
  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { role: 'user', text: trimmed }, { role: 'assistant', text: answerAttendanceQuestion(trimmed, { section, analyses, leaveSimulation: simulation, today, semesterStart, semesterEnd, defaultLeavePolicy }) }]);
    setQuery('');
  };
  return (
    <>
      {open && <div className="advisor-panel">
        <div className="advisor-header"><div><span className="advisor-eyebrow"><Bot size={13} /> Live dashboard advisor</span><strong>Attendance Advisor</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close advisor"><X size={16} /></button></div>
        <div className="advisor-messages">{messages.map((message, index) => <div className={`advisor-message message-${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}</div>
        <div className="advisor-suggestions"><button type="button" onClick={() => setQuery('Which subject is closest to detention?')}>Closest to detention</button><button type="button" onClick={() => setQuery('If I attend every remaining class, what will my final attendance be?')}>Attend all</button></div>
        <div className="advisor-input"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} placeholder="Ask about your attendance…" /><button type="button" onClick={submit} aria-label="Send question"><Send size={15} /></button></div>
        <span className="advisor-disclaimer">Deterministic fallback · answers use the calculator, not invented math</span>
      </div>}
      <button type="button" className={`advisor-fab ${open ? 'advisor-fab-open' : ''}`} onClick={() => setOpen((current) => !current)}><MessageCircle size={17} /><span>Ask Attendance Advisor</span></button>
    </>
  );
}

export default function Home() {
  const [today] = useState(() => dateOnly(new Date()));
  const semesterStart = useMemo(() => parseLocalDate(timetableDataset.meta.semesterStart), []);
  const semesterEnd = useMemo(() => parseLocalDate(timetableDataset.meta.semesterEnd), []);
  const effectiveStart = useMemo(() => clampDate(today, semesterStart, semesterEnd), [today, semesterStart, semesterEnd]);
  const [selectedSectionId, setSelectedSectionId] = useState(timetableDataset.sections[0].id);
  const selectedSection = useMemo(
    () => timetableDataset.sections.find((section) => section.id === selectedSectionId) ?? timetableDataset.sections[0],
    [selectedSectionId],
  );
  const [planDate, setPlanDate] = useState(() => toDateKey(clampDate(today, semesterStart, semesterEnd)));
  const [attendance, setAttendance] = useState<Record<string, AttendanceInput>>(() => createEmptyAttendance(selectedSection.subjects));
  const [leaveForm, setLeaveForm] = useState<LeaveFormState>(() => ({
    startDate: toDateKey(clampDate(addDays(effectiveStart, 1), semesterStart, semesterEnd)),
    endDate: toDateKey(clampDate(addDays(effectiveStart, 3), semesterStart, semesterEnd)),
    odDays: '0',
    medicalDays: '0',
    normalDays: '0',
    policy: { od: 'excluded', medical: 'excluded' },
  }));

  useEffect(() => {
    setAttendance(createEmptyAttendance(selectedSection.subjects));
  }, [selectedSectionId, selectedSection.subjects]);

  const planDateObject = useMemo(() => clampDate(parseLocalDate(planDate), effectiveStart, semesterEnd), [planDate, effectiveStart, semesterEnd]);
  const analyses = useMemo(
    () => selectedSection.subjects.map((subject) => analyzeSubject(selectedSection, subject, attendance[subject.code] ?? { attended: '', conducted: '' }, semesterStart, semesterEnd, today, planDateObject)),
    [selectedSection, attendance, semesterStart, semesterEnd, today, planDateObject],
  );
  const stats = useMemo(
    () => analyses.reduce(
      (result, analysis) => {
        result.total += 1;
        if (analysis.status === 'input') result.input += 1;
        else result[analysis.status] += 1;
        return result;
      },
      { total: 0, input: 0, safe: 0, attention: 0, 'high-risk': 0, irreversible: 0 } as Record<'total' | 'input' | 'safe' | 'attention' | 'high-risk' | 'irreversible', number>,
    ),
    [analyses],
  );
  const totalTermClasses = useMemo(() => countScheduled(selectedSection, effectiveStart, semesterEnd), [selectedSection, effectiveStart, semesterEnd]);
  const planClasses = useMemo(() => countScheduled(selectedSection, effectiveStart, planDateObject), [selectedSection, effectiveStart, planDateObject]);
  const daysUntilPlan = Math.max(0, Math.round((planDateObject.getTime() - effectiveStart.getTime()) / 86400000));
  const incompleteInput = stats.input > 0;
  const leaveSimulation = useMemo(() => simulateLeave(
    selectedSection,
    analyses,
    {
      startDate: parseLocalDate(leaveForm.startDate),
      endDate: parseLocalDate(leaveForm.endDate),
      odDays: Number(leaveForm.odDays) || 0,
      medicalDays: Number(leaveForm.medicalDays) || 0,
      normalDays: Number(leaveForm.normalDays) || 0,
      policy: leaveForm.policy,
    },
    semesterStart,
    semesterEnd,
    today,
  ), [selectedSection, analyses, leaveForm, semesterStart, semesterEnd, today]);
  const activeLeaveSimulation = (Number(leaveForm.odDays) || 0) + (Number(leaveForm.medicalDays) || 0) + (Number(leaveForm.normalDays) || 0) > 0 ? leaveSimulation : null;

  const updateAttendance = (subjectCode: string, field: keyof AttendanceInput, value: string) => {
    setAttendance((current) => ({
      ...current,
      [subjectCode]: { ...(current[subjectCode] ?? { attended: '', conducted: '' }), [field]: value },
    }));
  };

  const resetAttendance = () => setAttendance(createEmptyAttendance(selectedSection.subjects));

  return (
    <div className="app-shell">
      <header className="site-header">
        <a href="#top" className="brand" aria-label="Can I Miss? home">
          <span className="brand-mark"><Sparkles size={16} /></span>
          <span>Can I <span className="brand-dot">Miss?</span></span>
        </a>
        <nav className="top-nav" aria-label="Primary navigation">
          <a href="#planner">Planner</a>
          <a href="#subjects">Subjects</a>
          <a href="#time-machine">Time Machine</a>
          <a href="#method">Method</a>
        </nav>
        <div className="term-chip"><span className="live-dot" /> Odd Semester 2026–27</div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> Attendance, made legible</div>
            <h1>Can I <em>Miss?</em></h1>
            <p className="hero-lede"><strong>Can I Miss? — Your attendance knows.</strong><br />A timetable-aware attendance planner for SRMIST students. Enter what has happened, choose a planning date, and see the exact runway left for every subject.</p>
            <div className="hero-notes">
              <span><ShieldCheck size={15} /> No invented percentages</span>
              <span><Database size={15} /> Source timetable stays separate</span>
            </div>
          </div>
          <div className="hero-aside">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-stat-card">
              <span className="mini-label">Term window</span>
              <strong>{formatDate(semesterStart, { day: '2-digit', month: 'short' })} — {formatDate(semesterEnd, { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
              <div className="hero-stat-divider" />
              <span className="stat-small">{timetableDataset.sections.length} sections · {10} source PDFs</span>
            </div>
            <div className="hero-stamp"><span>75</span><small>% floor</small></div>
          </div>
        </section>

        <section className="planner-panel" id="planner">
          <div className="panel-header">
            <div>
              <div className="section-kicker">01 / Set your lens</div>
              <h2>Choose section & planning horizon</h2>
            </div>
            <div className="source-badge"><span className="live-dot" /> Timetable-only mode</div>
          </div>
          <div className="control-grid">
            <label className="control-field control-wide">
              <span className="control-label"><BookOpen size={14} /> Your section</span>
              <span className="select-wrap">
                <select value={selectedSectionId} onChange={(event) => setSelectedSectionId(event.target.value)}>
                  {timetableDataset.sections.map((section) => <option key={section.id} value={section.id}>{section.label} · {section.year}</option>)}
                </select>
                <ChevronDown size={16} />
              </span>
              <small>{selectedSection.sourceFile}</small>
            </label>
            <label className="control-field">
              <span className="control-label"><CalendarDays size={14} /> Plan up to</span>
              <input type="date" value={planDate} min={toDateKey(effectiveStart)} max={timetableDataset.meta.semesterEnd} onChange={(event) => setPlanDate(event.target.value)} />
              <small>{daysUntilPlan} days · {planClasses} scheduled classes</small>
            </label>
            <div className="term-window-field">
              <span className="control-label"><Clock3 size={14} /> Timetable window</span>
              <strong>{formatDate(effectiveStart)} → {formatDate(semesterEnd)}</strong>
              <small>{totalTermClasses} scheduled periods remaining in this section</small>
            </div>
          </div>
          <div className="panel-footnote"><CircleHelp size={14} /> The source folder contains no holiday calendar. Counts use Monday–Friday timetable occupancy only; breaks, lunch, and blank cells are excluded.</div>
        </section>

        <section className="dashboard-intro" id="subjects">
          <div>
            <div className="section-kicker">02 / Enter what has happened</div>
            <h2>{selectedSection.label} <span className="muted-title">attendance map</span></h2>
            <p>One clean input pair per subject. The dashboard never infers attended classes from a percentage.</p>
          </div>
          <button className="ghost-button" type="button" onClick={resetAttendance}><RotateCcw size={14} /> Reset inputs</button>
        </section>

        <section className="overview-grid" aria-label="Attendance overview">
          <div className="overview-lead">
            <span className="mini-label">Overall status</span>
            <strong>{incompleteInput ? 'Complete your current record to unlock the full picture.' : `${stats.safe + stats.attention + stats['high-risk'] + stats.irreversible} subjects analyzed.`}</strong>
            <div className="overview-progress"><div style={{ width: `${stats.total ? ((stats.total - stats.input) / stats.total) * 100 : 0}%` }} /></div>
            <span className="overview-foot">{stats.total - stats.input} of {stats.total} subjects with valid input</span>
          </div>
          <div className="overview-count"><strong>{stats.safe}</strong><span>Safe</span></div>
          <div className="overview-count"><strong>{stats.attention}</strong><span>On track</span></div>
          <div className="overview-count"><strong>{stats['high-risk']}</strong><span>High risk</span></div>
          <div className="overview-count overview-critical"><strong>{stats.irreversible}</strong><span>Irreversible</span></div>
        </section>

        <AttendanceHealth analyses={analyses} />

        <LeaveSimulator section={selectedSection} analyses={analyses} form={leaveForm} setForm={setLeaveForm} simulation={leaveSimulation} />

        <AttendanceTimeMachine key={selectedSection.id} section={selectedSection} analyses={analyses} semesterStart={semesterStart} semesterEnd={semesterEnd} today={today} />

        {stats.irreversible > 0 && (
          <aside className="warning-banner">
            <div className="warning-icon"><AlertTriangle size={19} /></div>
            <div><strong>Some subjects are mathematically past the recovery line.</strong><span>Even attending every timetable period left this term cannot bring them to 75%. Focus on protecting the subjects that still have a path.</span></div>
            <a href="#method">See the math <ArrowUpRight size={14} /></a>
          </aside>
        )}

        <div className="subject-list">
          {analyses.map((analysis) => (
            <SubjectCard
              key={analysis.subject.code}
              analysis={analysis}
              onUpdate={(field, value) => updateAttendance(analysis.subject.code, field, value)}
            />
          ))}
        </div>

        <SchedulePreview section={selectedSection} />

        <section className="method-section" id="method">
          <div className="method-heading">
            <div className="section-kicker">03 / Keep it honest</div>
            <h2>Built on the timetable, not a guess.</h2>
            <p>The calculator is intentionally small: it counts scheduled subject periods and applies the same two formulas to every subject.</p>
          </div>
          <div className="method-grid">
            <details open>
              <summary><span className="method-number">01</span><strong>Current attendance</strong><ChevronDown size={16} /></summary>
              <p><code>attended ÷ conducted × 100</code>. Conducted is the total class count you provide, not a number inferred from the timetable.</p>
            </details>
            <details>
              <summary><span className="method-number">02</span><strong>75% runway</strong><ChevronDown size={16} /></summary>
              <p>For each future class, the model asks whether attending it would make <code>(attended + future attended) ÷ (conducted + future classes)</code> reach 75%.</p>
            </details>
            <details>
              <summary><span className="method-number">03</span><strong>Plan-date forecast</strong><ChevronDown size={16} /></summary>
              <p>“Attend all” adds every timetable period through your plan date. “Miss all” adds the same conducted classes with zero additional attendance. Both are scenarios, not predictions.</p>
            </details>
          </div>
          <div className="method-footer">
            <span><Database size={14} /> 13 sections · 10 source PDFs</span>
            <a href={timetableDataset.meta.sourceFolder} target="_blank" rel="noreferrer">Open source folder <ArrowUpRight size={14} /></a>
            <span className="method-source-note">Source period cells are transcribed separately in <code>src/data/timetable.ts</code>.</span>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>Can I <span className="brand-dot">Miss?</span></span>
        <span>Made for clarity · Odd Semester 2026–27</span>
      </footer>
      <AttendanceAdvisor section={selectedSection} analyses={analyses} simulation={activeLeaveSimulation} today={today} semesterStart={semesterStart} semesterEnd={semesterEnd} defaultLeavePolicy={leaveForm.policy} />
    </div>
  );
}
