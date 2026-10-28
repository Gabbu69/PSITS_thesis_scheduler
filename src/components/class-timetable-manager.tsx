"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Plus, RefreshCw } from "lucide-react";
import { ClassScheduleBoard, ClassMeetingList, classDays, formatClock } from "./class-schedule-board";
import { local } from "@/lib/constraints";
import { meetingKey, type ClassMeetingInput } from "@/lib/class-timetable-rules";

type Revision = { id: string; number: number; status: string; effectiveFrom: string; effectiveTo: string; publishedAt: string | null; publisherName: string | null; meetings: ClassMeetingInput[]; affectedDefenses: { id: string; code: string; start: string; status: string }[] };
type Table = { id: string; facultyId: string; termId: string; version: number; revisions: Revision[] };
type Management = { faculty: { id: string; name: string }[]; terms: { id: string; year: string; semester: string }[]; timetables: Table[] };
type Operation = (op: "save" | "submit" | "publish", data: object) => Promise<boolean>;

export function ClassTimetableManager({ role }: { role: string }) {
  const canManage = role === "COORDINATOR" || role === "FACULTY";
  const [data, setData] = useState<Management | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [faculty, setFaculty] = useState(""), [term, setTerm] = useState(""), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [boardVersion, setBoardVersion] = useState(0);
  const load = useCallback(async () => {
    const r = await fetch("/api/class-schedules/manage", { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || "Timetables could not be loaded.");
    setData(d); setFaculty((f) => d.faculty.some((x: { id: string }) => x.id === f) ? f : d.faculty[0]?.id ?? "");
    setTerm((t) => d.terms.some((x: { id: string }) => x.id === t) ? t : d.terms[0]?.id ?? "");
  }, []);
  useEffect(() => { if (canManage) load().catch((e) => setError(e.message)); }, [canManage, load]);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", before); return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const action: Operation = async (op, body) => {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/class-schedules/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, data: body }), signal: AbortSignal.timeout(60000) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "The timetable could not be saved.");
      setDirty(false); await load(); setBoardVersion((v) => v + 1);
      setNotice(op === "save" ? "Draft saved. These class times now protect against defense conflicts. Submit when ready for coordinator review." : op === "submit" ? "Timetable submitted. The coordinator will review it before publication." : "Timetable published. The login page now shows this revision.");
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  const table = data?.timetables.find((t) => t.facultyId === faculty && t.termId === term);
  return <div className="class-management">
    {canManage && <section className="panel class-editor-panel" aria-labelledby="class-editor-title">
      <div className="panel-title"><div><h2 id="class-editor-title">{role === "FACULTY" ? "My class timetable" : "Faculty timetable review"}</h2><p>Save a draft, submit it for review, then the coordinator publishes it.</p></div><button disabled={busy || dirty} onClick={() => { setError(""); load().catch((e) => setError(e.message)); }}><RefreshCw size={16} aria-hidden="true" />Reload</button></div>
      {error && <div role="alert" className="error">{error}</div>}{notice && <div role="status" className="success">{notice}</div>}
      {!data ? <p role="status">{error ? "Use Reload to try again." : "Loading your class timetables…"}</p> : !data.faculty.length || !data.terms.length ? <div className="class-empty"><CalendarDays size={28} aria-hidden="true" /><h3>Finish college setup first</h3><p>{!data.faculty.length ? "The coordinator needs to create a faculty account." : "The coordinator needs to add an academic year and semester in College setup."}</p></div> : <>
        <div className="class-editor-selectors">
          <label>Professor<select value={faculty} disabled={busy || dirty} onChange={(e) => { setFaculty(e.target.value); setNotice(""); setError(""); }}>{data.faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <label>Academic year and semester<select value={term} disabled={busy || dirty} onChange={(e) => { setTerm(e.target.value); setNotice(""); setError(""); }}>{data.terms.map((t) => <option key={t.id} value={t.id}>{t.year} · {t.semester}</option>)}</select></label>
        </div>
        {role === "COORDINATOR" && <div className="class-review-queue"><strong>{data.timetables.filter((t) => t.revisions.some((r) => r.status === "SUBMITTED")).length} timetables awaiting review</strong><div>{data.timetables.filter((t) => t.revisions.some((r) => r.status === "SUBMITTED")).map((t) => <button key={t.id} disabled={busy || dirty} onClick={() => { setFaculty(t.facultyId); setTerm(t.termId); setNotice(""); setError(""); }}>{data.faculty.find((f) => f.id === t.facultyId)?.name} · {data.terms.find((x) => x.id === t.termId)?.semester} · {data.terms.find((x) => x.id === t.termId)?.year}</button>)}</div></div>}
        <TimetableEditor key={`${faculty}:${term}:${table?.version ?? 0}`} table={table} facultyId={faculty} termId={term} coordinator={role === "COORDINATOR"} busy={busy} action={action} onDirty={setDirty} />
      </>}
    </section>}
    <ClassScheduleBoard key={boardVersion} />
  </div>;
}

function TimetableEditor({ table, facultyId, termId, coordinator, busy, action, onDirty }: { table?: Table; facultyId: string; termId: string; coordinator: boolean; busy: boolean; action: Operation; onDirty: (value: boolean) => void }) {
  const working = table?.revisions.find((r) => ["DRAFT", "SUBMITTED"].includes(r.status));
  const published = table?.revisions.find((r) => r.status === "PUBLISHED");
  const original = working ?? published;
  const [from, setFrom] = useState(original?.effectiveFrom ?? ""), [to, setTo] = useState(original?.effectiveTo ?? "");
  const [meetings, setMeetings] = useState<ClassMeetingInput[]>(original?.meetings ?? []);
  const [dirty, setDirty] = useState(false), [entryDirty, setEntryDirty] = useState(false), [editing, setEditing] = useState<number | null>(null), [entryKey, setEntryKey] = useState(0);
  const [retire, setRetire] = useState(false);
  const [publishError, setPublishError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { onDirty(dirty || entryDirty); }, [dirty, entryDirty, onDirty]);
  const mark = () => setDirty(true);
  const resetEntry = () => { setEditing(null); setEntryDirty(false); setEntryKey((k) => k + 1); };
  const discard = () => { setFrom(original?.effectiveFrom ?? ""); setTo(original?.effectiveTo ?? ""); setMeetings(original?.meetings ?? []); setDirty(false); resetEntry(); };
  const before = new Set((published?.meetings ?? []).map(meetingKey)), after = new Set(meetings.map(meetingKey));
  const added = meetings.filter((m) => !before.has(meetingKey(m))), removed = (published?.meetings ?? []).filter((m) => !after.has(meetingKey(m)));
  return <div className="class-editor-body">
    <div className="class-editor-status"><span className="badge blue">{dirty || entryDirty ? "Unsaved changes" : working?.status === "SUBMITTED" ? "Awaiting coordinator review" : working ? "Saved draft" : published ? published.meetings.length ? "Published" : "Retired" : "New timetable"}</span>{published && <span>Public version: revision {published.number} · {local(published.publishedAt!, "MMM d, yyyy h:mm a")} PHT</span>}</div>
    <p className="class-guidance">Saved classes block defense scheduling immediately. Previously published times stay protected until their replacement is published. Continue submitting your available defense times separately.</p>
    <div className="class-editor-dates"><label>Effective from<input type="date" value={from} required disabled={busy} onChange={(e) => { setFrom(e.target.value); mark(); }} /></label><label>Effective through<input type="date" value={to} required disabled={busy} onChange={(e) => { setTo(e.target.value); mark(); }} /></label></div>
    <h3>Weekly classes</h3>
    {meetings.length ? <ul className="class-edit-list">{meetings.map((m, i) => <li key={i}><div><strong>{m.subjectCode} · {m.subjectName}</strong><span>{classDays[m.weekday]} · {formatClock(m.startTime)}–{formatClock(m.endTime)} PHT</span><span>Section {m.section} · {m.location}</span></div><div className="class-row-actions"><button disabled={busy || entryDirty} onClick={() => { setEditing(i); setEntryKey((k) => k + 1); }}>Edit</button><button disabled={busy || entryDirty} onClick={() => { setMeetings(meetings.filter((_, index) => index !== i)); mark(); resetEntry(); }}>Remove</button></div></li>)}</ul> : <p className="class-guidance">No weekly classes entered. Publishing an empty replacement retires the previous timetable.</p>}
    <MeetingForm key={`${entryKey}:${editing}`} initial={editing === null ? undefined : meetings[editing]} busy={busy} onChange={() => setEntryDirty(true)} cancel={resetEntry} onSave={(newMeetings) => { setMeetings(editing === null ? [...meetings, ...newMeetings] : meetings.flatMap((m, i) => i === editing ? newMeetings : [m])); mark(); resetEntry(); }} />
    {entryDirty && <p role="status">Add or update the class below, or cancel its entry, before saving your timetable.</p>}
    <div className="class-editor-actions">
      <button className="primary" disabled={busy || entryDirty || !from || !to || from > to || (!dirty && !!working)} onClick={() => action("save", { facultyId, termId, version: table?.version ?? 0, effectiveFrom: from, effectiveTo: to, meetings })}>{busy ? "Working…" : "Save draft"}</button>
      <button disabled={busy || dirty || entryDirty || working?.status !== "DRAFT"} onClick={() => action("submit", { id: table!.id, version: table!.version })}>Submit for review</button>
      {coordinator && <button className="primary" disabled={busy || dirty || entryDirty || working?.status !== "SUBMITTED"} onClick={() => { setRetire(false); setPublishError(""); dialog.current?.showModal(); }}>Review and publish</button>}
      {(dirty || entryDirty) && <button disabled={busy} onClick={discard}>Discard unsaved changes</button>}
    </div>
    {(dirty || entryDirty) && <p className="class-guidance">Save or discard changes before switching professor or semester. To reload a stale timetable, discard unsaved changes and use Reload.</p>}
    {working && !dirty && <ReviewChanges revision={working} published={published} added={added} removed={removed} />}
    {!!table?.revisions.some((r) => r.publishedAt) && <details className="class-history"><summary>Publication history</summary>{table.revisions.filter((r) => r.publishedAt).map((r) => <article key={r.id}><h4>Revision {r.number} · {r.status === "PUBLISHED" ? "Current publication" : "Previous publication"}</h4><p>{r.effectiveFrom}–{r.effectiveTo} · Published {local(r.publishedAt!, "MMM d, yyyy h:mm a")} PHT by {r.publisherName}</p>{r.meetings.length ? <ClassMeetingList meetings={r.meetings} /> : <p>Timetable retired.</p>}</article>)}</details>}
    <dialog ref={dialog} className="class-publish-dialog" aria-labelledby="class-publish-title" onCancel={(e) => { if (busy) e.preventDefault(); }}>
      <h2 id="class-publish-title">{working?.meetings.length ? "Publish faculty timetable?" : "Retire faculty timetable?"}</h2>
      <p>This replaces the professor’s public timetable for this semester. Existing defense reservations are retained; conflicts require coordinator action.</p>
      {working && <ReviewChanges revision={working} published={published} added={added} removed={removed} />}
      {working?.meetings.length ? <ClassMeetingList meetings={working.meetings} /> : <label className="class-retire-check"><input type="checkbox" checked={retire} onChange={(e) => setRetire(e.target.checked)} />I confirm this empty revision retires the previous timetable and releases its class-time restrictions.</label>}
      {publishError && <p className="error" role="alert">{publishError}</p>}
      <div className="class-editor-actions"><button disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button className="primary" disabled={busy || (!working?.meetings.length && !retire)} onClick={async () => { if (await action("publish", { id: table!.id, version: table!.version, confirmEmpty: retire })) dialog.current?.close(); else setPublishError("Publication was not completed. Close this review to read the error, then reload the timetable before trying again."); }}>{busy ? "Publishing…" : working?.meetings.length ? "Publish timetable" : "Confirm retirement"}</button></div>
    </dialog>
  </div>;
}
function ReviewChanges({ revision, published, added, removed }: { revision: Revision; published?: Revision; added: ClassMeetingInput[]; removed: ClassMeetingInput[] }) {
  return <div className="class-change-review"><h3>Changes for review</h3><p>{published ? `Replaces revision ${published.number}.` : "First publication for this professor and semester."} {added.length} meetings added · {removed.length} removed.</p>
    <p>Effective dates: {published ? `${published.effectiveFrom}–${published.effectiveTo} → ` : ""}{revision.effectiveFrom}–{revision.effectiveTo}</p>
    {added.length > 0 && <details><summary>Added meetings ({added.length})</summary><ClassMeetingList meetings={added} /></details>}
    {removed.length > 0 && <details><summary>Removed meetings ({removed.length})</summary><ClassMeetingList meetings={removed} /></details>}
    {revision.affectedDefenses.length ? <div className="class-conflict-warning"><strong>{revision.affectedDefenses.length} defense reservations overlap these classes</strong><ul>{revision.affectedDefenses.map((s) => <li key={s.id}>{s.code} · {local(s.start, "MMM d, yyyy h:mm a")} PHT · {s.status === "DRAFT" ? "Draft" : "Published"}</li>)}</ul><p>Review these in the defense schedule. Publication does not move them automatically.</p></div> : <p>No existing defense reservations overlap these classes.</p>}
  </div>;
}
function MeetingForm({ initial, busy, onSave, onChange, cancel }: { initial?: ClassMeetingInput; busy: boolean; onSave: (m: ClassMeetingInput[]) => void; onChange: () => void; cancel: () => void }) {
  const [error, setError] = useState("");
  return <form className="class-meeting-form" onChange={onChange} onSubmit={(e) => {
    e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
    const days = f.getAll("weekdays").map(Number), startTime = String(f.get("startTime")), endTime = String(f.get("endTime"));
    if (!days.length) { setError("Choose at least one weekday."); return; }
    if (startTime >= endTime) { setError("End time must be after start time. Split overnight classes into separate days."); return; }
    onSave(days.map((weekday) => ({ subjectCode: String(f.get("subjectCode")).trim(), subjectName: String(f.get("subjectName")).trim(), section: String(f.get("section")).trim(), location: String(f.get("location")).trim(), weekday, startTime, endTime })));
  }}>
    <h4>{initial ? "Edit class meeting" : "Add a class"}</h4>
    <fieldset disabled={busy}><div className="class-meeting-fields">
      <label>Subject code<input name="subjectCode" required maxLength={200} defaultValue={initial?.subjectCode ?? ""} placeholder="e.g. IT 101" /></label>
      <label>Subject name<input name="subjectName" required maxLength={200} defaultValue={initial?.subjectName ?? ""} placeholder="e.g. Introduction to Computing" /></label>
      <label>Section<input name="section" required maxLength={200} defaultValue={initial?.section ?? ""} /></label>
      <label>Room / location<input name="location" required maxLength={200} defaultValue={initial?.location ?? ""} placeholder="Room, building, or online" /></label>
      <label>Starts at<input name="startTime" type="time" required defaultValue={initial?.startTime ?? "08:00"} /></label>
      <label>Ends at<input name="endTime" type="time" required defaultValue={initial?.endTime ?? "09:00"} /></label>
    </div>
    <fieldset className="class-weekdays"><legend>Repeat on</legend>{[1, 2, 3, 4, 5, 6, 0].map((d) => <label key={d}><input type="checkbox" name="weekdays" value={d} defaultChecked={initial?.weekday === d} />{classDays[d].slice(0, 3)}</label>)}</fieldset>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="class-editor-actions"><button disabled={busy} type="submit"><Plus size={16} aria-hidden="true" />{initial ? "Update class" : "Add class"}</button><button disabled={busy} type="button" onClick={cancel}>Cancel class entry</button></div>
  </form>;
}
