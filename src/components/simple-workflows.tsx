"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, CalendarDays, Users, Plus } from "lucide-react";
import { local } from "@/lib/constraints";
type Data = any;
type Action = (op: string, body: Data) => Promise<boolean>;

export function SimpleHome({ d }: { d: Data }) {
  const admin = d.user.role === "COORDINATOR", faculty = d.user.role === "FACULTY";
  const ownTimes = d.windows.filter((w: Data) => w.userId === d.user.id && w.kind === "AVAILABLE");
  const groups = d.groups.filter((g: Data) => g.active);
  const upcoming = d.sessions.filter((s: Data) => s.status === "PUBLISHED" && new Date(s.end) >= new Date());
  const drafts = d.sessions.filter((s: Data) => s.status === "DRAFT");
  const review = groups.filter((g: Data) => g.attempts.some((a: Data) => a.readiness === "REQUESTED"));
  const setup = [
    { title: "Set up college records", href: "/settings", done: !!(d.sections.length && d.terms.length && d.stages.length), detail: "Programs, sections, term, and defense stages" },
    { title: "Add teacher and student accounts", href: "/accounts", done: !!(d.faculty.length && d.students.length), detail: "Use each person’s real name and email" },
    { title: "Create groups and assign faculty", href: "/groups", done: !!groups.length, detail: "Add members, an adviser, and a panel" },
    { title: "Add rooms and available times", href: "/rooms", done: !!(d.rooms.some((r: Data) => r.active) && d.windows.some((w: Data) => w.roomId && w.kind === "AVAILABLE")), detail: "Teachers and students submit their own times" },
  ];
  return <>
    {admin && <div className="quick-counts">
      {[["Groups", groups.length, "/groups"], ["Need review", review.length, "/groups"], ["Drafts", drafts.length, "/drafts"]].map(([label, count, href]) => <Link key={String(label)} href={String(href)}><strong>{count}</strong><span>{label}</span><ArrowRight size={18} aria-hidden="true" /></Link>)}
    </div>}
    {admin ? <section className="panel">
      <div className="panel-title"><h2>{setup.every((s) => s.done) ? "Next actions" : "Get your college ready"}</h2></div>
      <div className="task-list">{setup.filter((s) => !s.done).map((s, i) => <Link href={s.href} key={s.href}><span className="task-number">{i + 1}</span><div><strong>{s.title}</strong><small>{s.detail}</small></div><ArrowRight size={20} aria-hidden="true" /></Link>)}
        {review.length > 0 && <Link href="/groups"><Users size={24} /><div><strong>Review {review.length} submitted {review.length === 1 ? "group" : "groups"}</strong><small>Approve readiness before scheduling</small></div><ArrowRight size={20} /></Link>}
        <Link href="/drafts"><CalendarDays size={24} /><div><strong>{drafts.length ? "Review and publish your draft" : "Create a defense schedule"}</strong><small>Check available times, then publish</small></div><ArrowRight size={20} /></Link>
      </div>
    </section> : <section className="panel">
      <div className="panel-title"><h2>Your next step</h2></div>
      <div className="task-list">
        <Link href="/availability"><Clock3 size={26} /><div><strong>{ownTimes.length ? "Your available times are saved" : "Add your available times"}</strong><small>{ownTimes.length ? "Update them when your plans change" : "Choose days and times that work for you"}</small></div>{ownTimes.length ? <Check size={22} /> : <ArrowRight size={22} />}</Link>
        <Link href="/groups"><Users size={26} /><div><strong>{faculty ? `${groups.length} assigned groups` : groups[0]?.code ?? "Your group has not been added yet"}</strong><small>{faculty ? review.length ? `${review.length} waiting for review` : "Review members and readiness" : groups.length ? "Check members, adviser, and defense status" : "Ask your coordinator to add you to a group"}</small></div><ArrowRight size={22} /></Link>
      </div>
    </section>}
    <section className="panel"><div className="panel-title"><h2>{admin ? "Upcoming defenses" : "Your next defense"}</h2><Link className="text-link" href="/calendar">View schedule <ArrowRight size={16} /></Link></div>
      {upcoming.length ? <div className="defense-cards">{upcoming.slice(0, admin ? 3 : 1).map((s: Data) => <article key={s.id}><span className="badge green">{local(s.start, "MMM d, yyyy")}</span><h3>{s.snapshot.code} · {s.snapshot.stage}</h3><p>{s.snapshot.title}</p><strong>{local(s.start, "h:mm a")}–{local(s.end, "h:mm a")} PHT</strong><p>{s.snapshot.room.name} · {s.snapshot.room.building}</p><small>{s.snapshot.room.location}</small></article>)}</div> : <div className="simple-empty"><CalendarDays size={28} /><strong>No published defense yet</strong><p>{admin ? "Published schedules will appear here." : "Your coordinator will publish the date, time, and room here."}</p></div>}
    </section>
  </>;
}

export function SimpleAvailability({ d, action, busy, remove }: { d: Data; action: Action; busy: boolean; remove: (id: string) => void }) {
  const admin = d.user.role === "COORDINATOR";
  const [scope, setScope] = useState("person"), [resource, setResource] = useState(admin ? "" : d.user.id);
  const [mode, setMode] = useState("weekly"), [kind, setKind] = useState("AVAILABLE");
  const [editing, setEditing] = useState(false), [error, setError] = useState("");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const rows = d.windows.filter((w: Data) => admin ? scope === "college" ? !w.roomId && !w.userId : scope === "room" ? !!w.roomId && (!resource || w.roomId === resource) : !!w.userId && (!resource || w.userId === resource) : w.userId === d.user.id);
  const personName = (id: string) => d.users.find((u: Data) => u.id === id)?.name ?? "Person";
  return <>
    <section className="panel">
      <div className="panel-title"><div><h2>{admin ? "Available times" : "My available times"}</h2><p>All times are in Philippine Time.</p></div><button className="primary" onClick={() => setEditing(!editing)}><Plus size={18} />{editing ? "Close form" : "Add time"}</button></div>
      {admin && <div className="form-grid resource-filter">
        <label>For<select aria-label="For" value={scope} onChange={(e) => { setScope(e.target.value); setResource(""); setKind(e.target.value === "college" ? "BLOCK" : "AVAILABLE"); }}><option value="person">Person</option><option value="room">Room</option><option value="college">College closure</option></select></label>
        {scope !== "college" && <label>{scope === "person" ? "Person" : "Room"}<select aria-label={scope === "person" ? "Person" : "Room"} value={resource} onChange={(e) => setResource(e.target.value)}><option value="">{scope === "person" ? "Choose a person" : "Choose a room"}</option>{(scope === "person" ? d.users : d.rooms).map((r: Data) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>}
      </div>}
      {editing && <form className="availability-editor" onSubmit={async (e) => {
        e.preventDefault(); setError(""); const form = e.currentTarget; const f = new FormData(form);
        if (admin && scope !== "college" && !resource) { setError("Choose a person or room first."); return; }
        const weekdays = f.getAll("weekdays").map(Number);
        if (mode === "weekly" && !weekdays.length) { setError("Choose at least one day."); return; }
        const common = { userId: scope === "person" ? resource : null, roomId: scope === "room" ? resource : null, kind, startTime: f.get("startTime"), endTime: f.get("endTime"), label: f.get("label") || "", effectiveFrom: mode === "weekly" ? f.get("effectiveFrom") || null : null, effectiveTo: mode === "weekly" ? f.get("effectiveTo") || null : null };
        const saved = await action("availabilityBatch", mode === "weekly" ? weekdays.map((weekday) => ({ ...common, weekday, date: null })) : [{ ...common, date: f.get("date"), weekday: null }]);
        if (saved) { setEditing(false); form.reset(); }
      }}>
        <div className="form-grid">
          <label>Status<select aria-label="Status" value={kind} onChange={(e) => setKind(e.target.value)} disabled={scope === "college"}><option value="AVAILABLE">Available</option><option value="BLOCK">Unavailable</option></select></label>
          <label>Repeat<select aria-label="Repeat" value={mode} onChange={(e) => setMode(e.target.value)}><option value="weekly">Every week</option><option value="date">One date</option></select></label>
          {mode === "weekly" ? <fieldset className="span-two day-choices"><legend>Choose days</legend>{days.map((day, i) => <label key={day}><input type="checkbox" name="weekdays" value={i} /><span>{day.slice(0, 3)}</span></label>)}</fieldset> : <label className="span-two">Date<input name="date" type="date" required /></label>}
          <label>From<input type="time" name="startTime" defaultValue="08:00" required /></label><label>Until<input type="time" name="endTime" defaultValue="17:00" required /></label>
        </div>
        <details><summary>Dates and note (optional)</summary><div className="form-grid">
          {mode === "weekly" && <><label>Starts on<input type="date" name="effectiveFrom" /></label><label>Ends on<input type="date" name="effectiveTo" /></label></>}
          <label className="span-two">Note<input name="label" maxLength={200} /></label>
        </div></details>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="toolbar"><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save times"}</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      </form>}
      {rows.length ? <div className="time-list">{rows.map((w: Data) => <div key={w.id}>
        <span className={`badge ${w.kind === "BLOCK" ? "amber" : "green"}`}>{w.kind === "BLOCK" ? "Unavailable" : "Available"}</span>
        <div><strong>{w.date ? local(`${w.date}T00:00:00+08:00`, "MMM d, yyyy") : `Every ${days[w.weekday]}`}</strong><p>{w.startTime}–{w.endTime}{admin && ` · ${w.userId ? personName(w.userId) : d.rooms.find((r: Data) => r.id === w.roomId)?.name ?? "College closure"}`}</p>{(w.effectiveFrom || w.effectiveTo) && <small>{w.effectiveFrom ?? "Any date"} → {w.effectiveTo ?? "No end"}</small>}{w.label && <small>{w.label}</small>}</div>
        <button disabled={busy} onClick={() => remove(w.id)}>Remove</button>
      </div>)}</div> : <div className="simple-empty"><Clock3 size={28} /><strong>No times added</strong><p>Choose “Add time” to get started.</p></div>}
      <details><summary>How available times work</summary><p>A specific date replaces your weekly availability for that date. Unavailable times always take priority. Add a weekly range or a specific date before your defense can be scheduled.</p></details>
    </section>
  </>;
}

export function Accounts({ d, action, busy, edit }: { d: Data; action: Action; busy: boolean; edit: (u: Data) => void }) {
  const [adding, setAdding] = useState(false), [role, setRole] = useState("STUDENT"), [search, setSearch] = useState("");
  return <section className="panel">
    <div className="panel-title"><h2>People and accounts</h2><button className="primary" onClick={() => setAdding(!adding)}><Plus size={18} />{adding ? "Close form" : "Add account"}</button></div>
    {adding && <form className="account-editor" onSubmit={async (e) => {
      e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
      if (await action("user", { name: f.get("name"), email: f.get("email"), password: f.get("password"), role, ...(role === "STUDENT" ? { number: f.get("number") } : {}) })) { form.reset(); setAdding(false); }
    }}><div className="form-grid">
      <label>Account type<select aria-label="Account type" value={role} onChange={(e) => setRole(e.target.value)}><option value="STUDENT">Student</option><option value="FACULTY">Teacher</option><option value="COORDINATOR">Coordinator</option></select></label>
      <label>Full name<input name="name" required maxLength={200} autoComplete="off" /></label>
      <label>Email<input type="email" name="email" required autoComplete="off" /></label>
      {role === "STUDENT" && <label>Student number<input name="number" required /></label>}
      <label>Temporary password<input type="password" name="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>At least 12 characters. They’ll choose their own password at first sign-in.</small></label>
    </div><p>Give the person their login details privately. They’ll connect their own authenticator.</p><div className="toolbar"><button className="primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></div></form>}
    <label className="account-search">Find a person<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, or student number" /></label>
    <div className="people-list">{d.users.filter((u: Data) => `${u.name} ${u.email} ${u.student?.number ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((u: Data) => <div key={u.id}><span className="avatar">{u.name.charAt(0)}</span><div><strong>{u.name}</strong><p>{u.email}</p><small>{u.role === "FACULTY" ? "Teacher" : u.role === "COORDINATOR" ? "Coordinator" : `Student · ${u.student?.number}`}</small></div><span className={`badge ${u.twoFactorEnabled && !u.mustChangePassword ? "green" : "amber"}`}>{u.mustChangePassword ? "First sign-in pending" : u.twoFactorEnabled ? "Authenticator connected" : "Authenticator setup pending"}</span><button onClick={() => edit(u)}>Manage</button></div>)}</div>
  </section>;
}
