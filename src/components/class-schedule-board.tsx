"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Printer, RefreshCw, Search, Users } from "lucide-react";
import { local } from "@/lib/constraints";
import { defaultTimetableTerm, sortMeetings, type ClassMeetingInput, type PublicTimetable } from "@/lib/class-timetable-rules";

export const classDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function ClassMeetingList({ meetings }: { meetings: ClassMeetingInput[] }) {
  return <ul className="class-meeting-list">{[...meetings].sort(sortMeetings).map((m, i) => <li key={i}>
    <div className="class-meeting-time"><strong>{classDays[m.weekday]}</strong><span>{formatClock(m.startTime)}–{formatClock(m.endTime)}</span></div>
    <div className="class-meeting-subject"><strong>{m.subjectCode} <span>· {m.subjectName}</span></strong><span>Section {m.section} · {m.location}</span></div>
  </li>)}</ul>;
}
export function formatClock(value: string) {
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export function ClassScheduleBoard() {
  const [data, setData] = useState<{ timetables: PublicTimetable[]; terms: PublicTimetable["term"][] } | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  const [term, setTerm] = useState(""), [faculty, setFaculty] = useState(""), [day, setDay] = useState("");
  const [search, setSearch] = useState(""), [todayOnly, setTodayOnly] = useState(false), [today, setToday] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/api/class-schedules", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(async (r) => { if (!r.ok) throw new Error("Faculty schedules could not be loaded. Please try Refresh."); return r.json(); })
      .then((d) => { if (!controller.signal.aborted) { const date = local(new Date()); setToday(date); setData(d); setTerm((t) => d.terms.some((x: { id: string }) => x.id === t) ? t : defaultTimetableTerm(d.timetables, date)); } })
      .catch(() => { if (!controller.signal.aborted) setError("Faculty schedules could not be loaded. Please try Refresh."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const inTerm = data?.timetables.filter((r) => !term || r.term.id === term) ?? [];
  const professors = [...new Map(inTerm.map((r) => [r.faculty.id, r.faculty])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const rows = inTerm.filter((r) => (!faculty || r.faculty.id === faculty) && r.faculty.name.toLowerCase().includes(search.trim().toLowerCase()) && (!todayOnly || (r.effectiveFrom <= today && r.effectiveTo >= today)))
    .map((r) => ({ ...r, meetings: r.meetings.filter((m) => day === "" || m.weekday === Number(day)) })).filter((r) => r.meetings.length);
  return <section id="class-schedules-board" className="class-board" aria-labelledby="class-board-title" tabIndex={-1}>
    <header className="class-board-header"><div className="class-board-eyebrow"><CalendarDays size={18} aria-hidden="true" />COLLEGE TIMETABLES</div>
      <h2 id="class-board-title">Faculty Class Schedules</h2><p>Find your professor’s regular classes, without signing in.</p>
      <div className="class-board-note"><Clock3 size={16} aria-hidden="true" />All times are Philippine Time (PHT). Published by the coordinator.</div>
    </header>
    <div className="class-board-controls">
      <label className="class-search"><span>Find a professor</span><span className="class-search-input"><Search size={18} aria-hidden="true" /><input type="search" value={search} maxLength={200} onChange={(e) => setSearch(e.target.value)} placeholder="Search by professor’s name" /></span></label>
      <div className="class-filter-grid">
        <label>Semester<select value={term} onChange={(e) => { setTerm(e.target.value); setFaculty(""); }}>{!data?.terms.length && <option value="">No published semester</option>}{data?.terms.map((t) => <option key={t.id} value={t.id}>{t.year} · {t.semester}</option>)}</select></label>
        <label>Professor<select value={faculty} onChange={(e) => setFaculty(e.target.value)}><option value="">All faculty</option>{professors.map((f) => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label>
        <label>Day<select value={day} onChange={(e) => { setDay(e.target.value); setTodayOnly(false); }}><option value="">All days</option>{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{classDays[d]}</option>)}</select></label>
      </div>
      <div className="class-board-actions">
        <button type="button" aria-pressed={todayOnly} onClick={() => { const date = local(new Date()); setToday(date); setTodayOnly(!todayOnly); setDay(todayOnly ? "" : String(new Date(`${date}T12:00Z`).getUTCDay())); }}>Today</button>
        <button type="button" onClick={() => { setSearch(""); setFaculty(""); setDay(""); setTodayOnly(false); setTerm(defaultTimetableTerm(data?.timetables ?? [], local(new Date()))); }}>Clear filters</button>
        <button type="button" disabled={loading} onClick={() => setRefresh((r) => r + 1)}><RefreshCw size={16} aria-hidden="true" />{loading ? "Loading…" : "Refresh"}</button>
        <button type="button" disabled={!rows.length} onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print</button>
      </div>
    </div>
    {error && <div className="error" role="alert">{error}{data && " Previously loaded schedules are shown below."}</div>}
    <div className="class-board-results" aria-busy={loading}>
      <p className="class-result-count" role="status">{loading ? "Loading published class timetables…" : `${rows.length} ${rows.length === 1 ? "professor" : "professors"} · ${rows.reduce((n, r) => n + r.meetings.length, 0)} weekly class meetings${todayOnly ? ` · ${local(`${today}T12:00:00+08:00`, "MMM d, yyyy")}` : ""}`}</p>
      {rows.map((r) => <article key={r.id} className="class-faculty-card">
        <header><div className="class-faculty-name"><Users size={21} aria-hidden="true" /><h3>{r.faculty.name}</h3></div><p>{r.term.year} · {r.term.semester}</p><small>Effective {local(`${r.effectiveFrom}T12:00:00+08:00`, "MMM d, yyyy")}–{local(`${r.effectiveTo}T12:00:00+08:00`, "MMM d, yyyy")} · Published {local(r.publishedAt, "MMM d, yyyy h:mm a")} PHT</small></header>
        <ClassMeetingList meetings={r.meetings} />
      </article>)}
      {!loading && !error && !rows.length && <div className="class-empty"><CalendarDays size={32} aria-hidden="true" /><h3>{data?.timetables.some((r) => r.meetings.length) ? "No matching classes" : "No timetables published"}</h3><p>{data?.timetables.some((r) => r.meetings.length) ? "Try another professor, day, or semester, or clear the filters." : "Faculty class schedules will appear here after the coordinator publishes them."}</p></div>}
    </div>
    <p className="class-board-footer">This board shows regular classes. Missing entries do not mean a professor is available. Your private thesis defense schedule is available in your account.</p>
  </section>;
}
