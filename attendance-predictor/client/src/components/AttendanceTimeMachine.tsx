import { useMemo, useState } from 'react';
import { ArrowRight, Check, History, Play, Target, TimerReset, Zap } from 'lucide-react';
import type { SectionDefinition } from '@/data/timetable';
import {
  addDays,
  formatDate,
  formatPercent,
  getSubjectSchedule,
  minimumAttendances,
  type SubjectAnalysis,
} from '@/lib/attendance';

type TimeMachineProps = {
  section: SectionDefinition;
  analyses: SubjectAnalysis[];
  semesterStart: Date;
  semesterEnd: Date;
  today: Date;
};

type ReplayClass = {
  id: string;
  date: Date;
  periods: number[];
};

function dateInputMax(today: Date, semesterEnd: Date) {
  const yesterday = addDays(today, -1);
  return yesterday.getTime() < semesterEnd.getTime() ? yesterday : semesterEnd;
}

function statusAfter(percent: number | null) {
  if (percent === null) return 'INPUT NEEDED';
  return percent >= 75 ? 'SAFE ZONE' : 'NEEDS RECOVERY';
}

export default function AttendanceTimeMachine({ section, analyses, semesterStart, semesterEnd, today }: TimeMachineProps) {
  const validAnalyses = useMemo(() => analyses.filter((analysis) => analysis.validInput), [analyses]);
  const [subjectCode, setSubjectCode] = useState(analyses[0]?.subject.code ?? '');
  const selectedAnalysis = analyses.find((analysis) => analysis.subject.code === subjectCode) ?? validAnalyses[0] ?? analyses[0];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const replayEnd = dateInputMax(today, semesterEnd);
  const replayOptions = useMemo<ReplayClass[]>(() => {
    if (!selectedAnalysis) return [];
    return getSubjectSchedule(section, selectedAnalysis.subject.code, semesterStart, replayEnd).map(({ date, periods }) => ({
      id: `${selectedAnalysis.subject.code}-${date.toISOString().slice(0, 10)}`,
      date,
      periods,
    }));
  }, [section, selectedAnalysis, semesterStart, replayEnd]);

  const selectedCount = Math.min(selectedIds.length, selectedAnalysis?.validInput ? Math.max(0, selectedAnalysis.conducted - selectedAnalysis.attended) : 0);
  const actualPercent = selectedAnalysis?.currentPercent ?? null;
  const replayedAttended = selectedAnalysis?.validInput ? selectedAnalysis.attended + selectedCount : 0;
  const replayedConducted = selectedAnalysis?.validInput ? selectedAnalysis.conducted : 0;
  const replayedPercent = replayedConducted > 0 ? (replayedAttended / replayedConducted) * 100 : null;
  const impact = actualPercent !== null && replayedPercent !== null ? replayedPercent - actualPercent : null;
  const currentMissed = selectedAnalysis?.validInput ? selectedAnalysis.conducted - selectedAnalysis.attended : 0;
  const replayedMissed = Math.max(0, currentMissed - selectedCount);
  const crossedFloor = actualPercent !== null && replayedPercent !== null && actualPercent < 75 && replayedPercent >= 75;
  const requiredForFloor = selectedAnalysis?.validInput ? minimumAttendances(selectedAnalysis.attended, selectedAnalysis.conducted, selectedCount, 0.75) : null;

  const toggleReplayClass = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (selectedAnalysis?.validInput && current.length >= currentMissed) return current;
      return [...current, id];
    });
  };

  const clearReplay = () => setSelectedIds([]);

  return (
    <section className="time-machine-section" id="time-machine">
      <div className="phase2-heading">
        <div>
          <div className="section-kicker"><History size={12} /> 05 / Attendance Time Machine</div>
          <h2>Replay the semester. Keep the lesson.</h2>
          <p>Choose past timetable classes you confirm were missed, then see the alternate timeline without changing your actual record.</p>
        </div>
        <div className="health-source"><TimerReset size={15} /> Simulation only</div>
      </div>

      <div className="time-machine-panel">
        <div className="time-machine-controls">
          <label className="compact-field time-machine-subject"><span>Replay subject</span><select value={selectedAnalysis?.subject.code ?? ''} onChange={(event) => { setSubjectCode(event.target.value); setSelectedIds([]); }}><option value="" disabled>Select a subject</option>{analyses.map((analysis) => <option key={analysis.subject.code} value={analysis.subject.code}>{analysis.subject.code} · {analysis.subject.name}</option>)}</select></label>
          <div className="time-machine-note"><History size={15} /><span>Past dates come from the authoritative timetable through {formatDate(replayEnd)}. Class-level attendance history is not synced, so only select dates you know were absences.</span></div>
        </div>

        {!selectedAnalysis?.validInput ? (
          <div className="time-machine-empty"><Target size={18} /><div><strong>Enter a valid attended / conducted total first.</strong><span>The Time Machine will keep the actual record separate from the replay.</span></div></div>
        ) : (
          <>
            <div className="timeline-rail" aria-label="Replay timeline"><span className="timeline-step is-active"><i>01</i><strong>Past</strong><small>select absences</small></span><span className="timeline-line" /><span className={`timeline-step ${selectedCount ? 'is-active' : ''}`}><i>02</i><strong>Alternate timeline</strong><small>replay selected</small></span><span className="timeline-line" /><span className="timeline-step is-now"><i>03</i><strong>Now</strong><small>protect your margin</small></span></div>

            <div className="time-machine-grid">
              <div className="history-picker">
                <div className="history-picker-head"><div><span className="mini-label">Attendance history input</span><strong>Select past missed classes</strong></div><span className="selection-count">{selectedCount} selected</span></div>
                <div className="history-list">
                  {replayOptions.length ? replayOptions.map((item) => {
                    const selected = selectedIds.includes(item.id);
                    return <label className={`history-item ${selected ? 'history-item-selected' : ''}`} key={item.id}><input type="checkbox" checked={selected} onChange={() => toggleReplayClass(item.id)} /><span className="history-date"><strong>{formatDate(item.date, { day: '2-digit', month: 'short' })}</strong><small>{item.periods.length === 1 ? '1 timetable period' : `${item.periods.length} timetable periods`}</small></span><span className="history-subject">{selectedAnalysis.subject.name}</span><span className="history-replay"><Play size={12} /> {selected ? 'Replayed' : 'Mark missed'}</span></label>;
                  }) : <div className="chart-empty"><History size={16} /> No past timetable classes are available for this subject yet.</div>}
                </div>
                <div className="history-picker-footer"><span>Only the selected absence count is replayed; actual inputs stay untouched.</span>{selectedCount > 0 && <button type="button" className="ghost-button" onClick={clearReplay}>Clear replay</button>}</div>
              </div>

              <div className="replay-result" aria-live="polite">
                <div className="replay-result-label"><span className="mini-label">Actual vs simulated</span><span className="replay-badge"><Zap size={12} /> Alternate timeline</span></div>
                <div className="replay-percentages"><div><small>REAL TIMELINE</small><strong>{formatPercent(actualPercent)}</strong><span>{selectedAnalysis.attended} attended · {currentMissed} missed</span></div><ArrowRight size={18} className="replay-arrow" /><div className="replay-alt"><small>IF ATTENDED</small><strong>{formatPercent(replayedPercent)}</strong><span>{replayedAttended} attended · {replayedMissed} missed</span></div></div>
                <div className="replay-difference"><span>Impact</span><strong className={impact !== null && impact > 0 ? 'positive-impact' : ''}>{impact === null ? '—' : `${impact >= 0 ? '+' : ''}${impact.toFixed(1)}%`}</strong><span>{statusAfter(actualPercent)} <ArrowRight size={12} /> {statusAfter(replayedPercent)}</span></div>
                {crossedFloor ? <div className="replay-crossed"><Check size={17} /><strong>You would have crossed the required attendance limit.</strong></div> : <div className="replay-insight"><Target size={16} /><span>{selectedCount === 0 ? 'Select one or more confirmed absences to build an alternate timeline.' : actualPercent !== null && actualPercent >= 75 ? 'These absences reduced your margin, but your current record remains above the required floor.' : requiredForFloor !== null && requiredForFloor <= selectedCount ? `Attending ${requiredForFloor} of these selected classes would have reached the 75% floor.` : `These ${selectedCount} replayed absence${selectedCount === 1 ? '' : 's'} add ${impact?.toFixed(1) ?? '0.0'} points back, but the 75% floor remains out of reach in this replay.`}</span></div>}
                {selectedCount > 0 && <button type="button" className="replay-rescue-link" onClick={() => document.getElementById('rescue-mode')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Zap size={13} /> Want to fix your attendance from here? <strong>Start Rescue Plan</strong><ArrowRight size={13} /></button>}
              </div>
            </div>
          </>
        )}
      </div>

      <RescueMode analyses={validAnalyses} selectedAnalysis={selectedAnalysis} onStart={() => document.getElementById('rescue-mode')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
    </section>
  );
}

function RescueMode({ analyses, selectedAnalysis, onStart }: { analyses: SubjectAnalysis[]; selectedAnalysis?: SubjectAnalysis; onStart: () => void }) {
  const [started, setStarted] = useState(false);
  const health = useMemo(() => {
    const attended = analyses.reduce((sum, item) => sum + item.attended, 0);
    const conducted = analyses.reduce((sum, item) => sum + item.conducted, 0);
    const remaining = analyses.reduce((sum, item) => sum + item.remaining, 0);
    const percent = conducted > 0 ? (attended / conducted) * 100 : null;
    const required = percent !== null && percent < 75 ? minimumAttendances(attended, conducted, remaining, 0.75) : 0;
    return { attended, conducted, remaining, percent, required };
  }, [analyses]);
  const roadmap = Array.from({ length: Math.min(Math.max(health.required, 1), 7) + 1 }, (_, index) => ({ index, percent: health.conducted > 0 ? ((health.attended + index) / (health.conducted + index)) * 100 : null }));
  const sorted = [...analyses].sort((a, b) => (a.currentPercent ?? 101) - (b.currentPercent ?? 101)).slice(0, 3);
  const rescued = health.percent !== null && health.percent >= 75;

  return <section className={`rescue-mode ${started ? 'rescue-mode-started' : ''}`} id="rescue-mode">
    <div className="rescue-header"><div><div className="section-kicker"><Zap size={12} /> Attendance Rescue Mode</div><h3>{rescued ? 'Attendance rescued.' : 'Turn the replay into a recovery plan.'}</h3><p>{rescued ? 'You are already in the safe zone. Protect the margin you have built.' : 'A clear, timetable-aware path from your actual record back to the 75% floor.'}</p></div><span className={`rescue-status ${rescued ? 'rescue-status-safe' : 'rescue-status-risk'}`}>{rescued ? 'SAFE ZONE' : 'NEEDS RECOVERY'}</span></div>
    {analyses.length ? <>
      <div className="rescue-summary"><div><span>Current attendance</span><strong>{formatPercent(health.percent)}</strong></div><div><span>Required</span><strong>75%</strong></div><div><span>Classes to target</span><strong>{health.required}</strong></div><div><span>Available runway</span><strong>{health.remaining}</strong></div></div>
      <div className="rescue-roadmap"><div className="roadmap-heading"><span className="mini-label">Recovery roadmap</span><span>Attend every class in the streak</span></div><div className="roadmap-track">{roadmap.map((step) => <div className={`roadmap-step ${step.percent !== null && step.percent >= 75 ? 'roadmap-safe' : ''}`} key={step.index}><i>{step.index === 0 ? 'NOW' : `+${step.index}`}</i><strong>{formatPercent(step.percent)}</strong><small>{step.index === 0 ? 'actual' : step.index === roadmap.length - 1 && health.required > 7 ? 'first 7' : 'class'}</small></div>)}</div></div>
      <div className="rescue-bottom"><div className="priority-card"><div className="roadmap-heading"><span className="mini-label">Subject priority</span><span>Actual records only</span></div>{sorted.map((item) => <div className="priority-row" key={item.subject.code}><span className={`priority-dot ${item.currentPercent !== null && item.currentPercent < 75 ? 'priority-danger' : item.currentPercent !== null && item.currentPercent < 90 ? 'priority-watch' : 'priority-safe'}`} /><strong>{item.subject.name}</strong><span>{formatPercent(item.currentPercent)}</span></div>)}</div><div className="streak-card"><div className="roadmap-heading"><span className="mini-label">Rescue streak</span><span>Simulated, not saved</span></div><strong>{started ? Math.min(health.required, 7) : 0} / {Math.min(Math.max(health.required, 1), 7)} classes</strong><div className="streak-track"><span style={{ width: `${started && health.required ? Math.min(100, (Math.min(health.required, 7) / Math.min(Math.max(health.required, 1), 7)) * 100) : 0}%` }} /></div><small>{rescued ? 'You are back in the safe zone.' : 'Start a plan to preview your recovery streak.'}</small></div></div>
      {!rescued && <button type="button" className="rescue-cta" onClick={() => { setStarted(true); onStart(); }}><Play size={15} /> Start Rescue Plan <ArrowRight size={15} /></button>}
    </> : <div className="time-machine-empty"><Target size={18} /><div><strong>Add at least one valid subject record.</strong><span>Rescue Mode uses the same actual attendance totals as the dashboard.</span></div></div>}
  </section>;
}
