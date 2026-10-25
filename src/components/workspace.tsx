"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  DoorOpen,
  SlidersHorizontal,
  FileText,
  Clock3,
  Bell,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Plus,
  Check,
  ArrowRight,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  GraduationCap,
  Menu,
  X,
  Download,
  ShieldCheck,
  TriangleAlert,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { local } from "@/lib/constraints";
import { SimpleHome, SimpleAvailability, Accounts } from "./simple-workflows";
import { SignOutButton } from "./sign-out-button";
type Data = any;
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: any;
  required?: boolean;
  hint?: string;
};
const nav = [
  ["/", "Home", LayoutDashboard],
  ["/groups", "Thesis groups", GraduationCap],
  ["/accounts", "Accounts", Users],
  ["/faculty", "Teachers", Users],
  ["/availability", "Availability", Clock3],
  ["/rooms", "Rooms", DoorOpen],
  ["/drafts", "Create schedule", Sparkles],
  ["/calendar", "Schedule", CalendarDays],
  ["/notifications", "Notifications", Bell],
  ["/waiting", "Waiting list", TriangleAlert],
  ["/reports", "Reports", FileText],
  ["/settings", "College setup", SlidersHorizontal],
] as const;
const options = (rows: Data[], label: (r: Data) => string = (r) => r.name) =>
  rows.map((r) => ({ value: r.id, label: label(r) }));
function Badge({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <CalendarDays size={28} />
      <p>{children}</p>
    </div>
  );
}
export function Workspace() {
  const path = usePathname(),
    { theme, setTheme } = useTheme();
  const [data, setData] = useState<Data>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [modal, setModal] = useState<{
    title: string;
    op: string;
    fields: Field[];
    initial?: Data;
  } | null>(null);
  const [report, setReport] = useState<Data>({ type: "master" }),
    [roster, setRoster] = useState<Data[] | null>(null);
  async function refresh() {
    const r = await fetch("/api/data");
    if (r.status === 401) {
      location.href = "/login";
      return;
    }
    const d = await r.json();
    if (d.error === "PASSWORD_CHANGE_REQUIRED" || d.error === "MFA_SETUP_REQUIRED") { location.href = d.error === "PASSWORD_CHANGE_REQUIRED" ? "/account" : "/security"; return; }
    if (!r.ok) throw new Error(d.error);
    setData(d);
    if (!data)
      setReport({
        type:
          d.user.role === "COORDINATOR"
            ? "master"
            : d.user.role === "FACULTY"
              ? "faculty"
              : "group",
      });
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setSearch("");
    setMobile(false);
    setProfileOpen(false);
  }, [path]);
  useEffect(() => {
    const navigation = document.querySelector<HTMLElement>(".sidebar nav");
    if (!navigation) return;
    const active = navigation.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    const showActive = () => {
      if (active && navigation.clientHeight) {
        const item = active.getBoundingClientRect(),
          container = navigation.getBoundingClientRect();
        if (item.bottom > container.bottom)
          navigation.scrollTop += item.bottom - container.bottom + 6;
        else if (item.top < container.top)
          navigation.scrollTop -= container.top - item.top + 6;
      }
    };
    showActive();
    const observer = new ResizeObserver(showActive);
    observer.observe(navigation);
    return () => observer.disconnect();
  }, [path, data?.user.role, mobile, profileOpen]);
  useEffect(() => {
    if (!profileOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".profile-menu"))
        setProfileOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [profileOpen]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = document.getElementById("workspace-navigation");
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled),select:not(:disabled)",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") setMobile(false);
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1025px)");
    const onDesktop = () => {
      if (desktop.matches) setMobile(false);
    };
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
      previous?.focus();
    };
  }, [mobile]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href]",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setModal(null);
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal, busy]);
  async function action(op: string, body: Data): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, data: body }),
        signal: AbortSignal.timeout(60000),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuccess(
        op === "generate"
          ? `Draft generated: ${d.result.proposals.length} groups · ${d.result.students} students · ${d.result.waiting.length} waiting.`
          : "Saved successfully.",
      );
      setModal(null);
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="loading">
        <img src="/logo.jpg" alt="PSITS" />
        <h2>{error || "Opening your college workspace…"}</h2>
      </main>
    );
  const d = data,
    admin = d.user.role === "COORDINATOR",
    faculty = d.user.role === "FACULTY";
  const allowed = admin ? nav : nav.filter(([p]) => ["/", "/groups", "/availability", "/calendar", "/notifications", "/reports", ...(faculty ? ["/faculty"] : [])].includes(p));
  const roleLabel = (p: string, label: string) => !admin ? ({ "/groups": faculty ? "My groups" : "My group", "/availability": "My availability", "/calendar": "My schedule", "/faculty": "My workload" } as Record<string,string>)[p] ?? label : label;
  const mainPaths = admin ? ["/", "/groups", "/calendar", "/availability", "/accounts", "/settings"] : ["/", "/groups", "/availability", "/calendar", ...(faculty ? ["/faculty"] : [])];
  const visibleNav = mainPaths.map((p) => allowed.find(([url]) => url === p)!);
  const moreNav = allowed.filter(([p]) => !mainPaths.includes(p) && !["/notifications", "/drafts"].includes(p));
  const page = roleLabel(path, nav.find((n) => n[0] === path)?.[1] ?? "Page unavailable");
  const groups = d.groups.filter((g: Data) => g.active),
    attempts = groups.flatMap((g: Data) =>
      g.attempts.map((a: Data) => ({ ...a, group: g })),
    );
  const sessions = d.sessions,
    drafts = sessions.filter((s: Data) => s.status === "DRAFT"),
    published = sessions.filter((s: Data) => s.status === "PUBLISHED");
  const waiting = attempts.filter(
    (a: Data) =>
      !sessions.some(
        (s: Data) => s.attemptId === a.id && s.status !== "CANCELLED",
      ),
  );
  const filtered = (rows: Data[], get: (r: Data) => string) =>
    rows.filter((r) => get(r).toLowerCase().includes(search.toLowerCase()));
  const names = (rows: Data[]) => rows.map((p) => p.name).join(", ");
  const groupOpts = options(groups, (g) => g.code + " · " + g.title),
    facultyOpts = options(d.faculty, (f) => f.user.name),
    stageOpts = options(d.stages);
  const open = (
    title: string,
    op: string,
    fields: Field[],
    initial: Data = {},
  ) => {
    setError("");
    setFormStep(0);
    setModal({ title, op, fields, initial });
  };
  const groupForm = () =>
    open("Create thesis group", "group", [
      { name: "code", label: "Group identifier" },
      { name: "title", label: "Thesis title", type: "textarea" },
      {
        name: "sectionId",
        label: "Program / section",
        options: options(d.sections, (s) => s.program.name + " · " + s.name),
      },
      {
        name: "termId",
        label: "Academic term",
        options: options(d.terms, (t) => t.year + " · " + t.semester),
      },
      { name: "course", label: "Thesis course", value: "THESIS" },
      {
        name: "studentIds",
        label: "Student members",
        type: "multi",
        options: options(d.students, (s) => s.number + " · " + s.user.name),
      },
      { name: "stageId", label: "Defense stage", options: stageOpts },
      {
        name: "attendees",
        label: "Additional attendees",
        type: "number",
        value: 0,
      },
    ]);
  function sessionEdit(s: Data) {
    open(
      s.status === "DRAFT"
        ? "Edit proposed session"
        : "Reschedule published defense",
      "session",
      [
        {
          name: "date",
          label: "Defense date (PHT)",
          type: "date",
          value: local(s.start),
        },
        {
          name: "time",
          label: "Start time (PHT)",
          type: "time",
          value: local(s.start, "HH:mm"),
        },
        {
          name: "roomId",
          label: "Room",
          options: options(d.rooms),
          value: s.roomId,
        },
        { name: "reason", label: "Reason", type: "textarea" },
      ],
      { id: s.id, action: s.status === "DRAFT" ? "EDIT" : "RESCHEDULE" },
    );
  }
  function scheduleTable(rows: Data[]) {
    return rows.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group & defense</th>
              <th>Date & time · PHT</th>
              <th>Venue</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered(rows, (s) => JSON.stringify(s.snapshot)).map((s) => {
              const c = s.snapshot;
              return (
                <tr key={s.id}>
                  <td>
                    <strong>{c.code}</strong>
                    <span className="cell-title">{c.title}</span>
                    <small>
                      {c.stage} · {c.students.length} students
                    </small>
                  </td>
                  <td>
                    <strong>{local(s.start, "MMM d, yyyy")}</strong>
                    <small>
                      {local(s.start, "hh:mm a")} – {local(s.end, "hh:mm a")}
                    </small>
                  </td>
                  <td>
                    <strong>{c.room.name}</strong>
                    <small>
                      {c.room.building}
                      <br />
                      {c.room.location}
                    </small>
                  </td>
                  <td>
                    <Badge
                      tone={
                        s.status === "PUBLISHED"
                          ? "green"
                          : s.status === "CANCELLED"
                            ? "red"
                            : "blue"
                      }
                    >
                      {s.status === "PUBLISHED" ? "Published" : s.status === "DRAFT" ? "Draft" : s.status === "COMPLETED" ? "Completed" : "Cancelled"}
                    </Badge>
                    {s.locked && <small>Locked draft</small>}
                    {s.attention && <Badge tone="amber">Requires review</Badge>}
                  </td>
                  <td>
                    <details className="schedule-actions"><summary>{admin ? "Manage" : "History"}</summary><div className="row-actions">
                      {admin && ["DRAFT", "PUBLISHED"].includes(s.status) && (
                        <button onClick={() => sessionEdit(s)}>Edit</button>
                      )}
                      {admin && s.status === "DRAFT" && (
                        <button
                          onClick={() =>
                            action("session", { id: s.id, action: "LOCK" })
                          }
                        >
                          {s.locked ? "Unlock" : "Lock"}
                        </button>
                      )}
                      {admin && s.status === "PUBLISHED" && (
                        <>
                          <button
                            onClick={() =>
                              open(
                                "Cancel defense",
                                "session",
                                [
                                  {
                                    name: "reason",
                                    label: "Cancellation reason",
                                    type: "textarea",
                                  },
                                ],
                                { id: s.id, action: "CANCEL" },
                              )
                            }
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              open(
                                "Complete defense",
                                "session",
                                [{ name: "reason", label: "Completion note" }],
                                { id: s.id, action: "COMPLETE" },
                              )
                            }
                          >
                            Complete
                          </button>
                        </>
                      )}
                      <button
                        onClick={() =>
                          open("Schedule history", "history", [], {
                            history: s.history,
                          })
                        }
                      >
                        History
                      </button>
                    </div></details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty>
        No sessions here yet.{" "}
        {admin
          ? "Generate a draft when the groups are ready."
          : "Your published defense will appear here."}
      </Empty>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {mobile && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Link href="/" className="brand">
            <img src={d.college.logo} alt="College logo" />
            <div>
              PSITS<span>DEFENSE SCHEDULER</span>
            </div>
          </Link>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {visibleNav.map(([url, label, Icon]) => (
            <Link
              key={url}
              href={url}
              className={path === url ? "active" : ""}
              aria-current={path === url ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <Icon size={22} aria-hidden="true" />
              {roleLabel(url, label)}
              {url === "/waiting" && waiting.length > 0 && (
                <span className="nav-count">{waiting.length}</span>
              )}
            </Link>
          ))}
          <details className="nav-secondary" key={path} open={moreNav.some(([url]) => url === path)}><summary>More <ChevronDown size={16} aria-hidden="true" /></summary>{moreNav.map(([url,label,Icon]) => <Link key={url} href={url} className={path === url ? "active" : ""} aria-current={path === url ? "page" : undefined}><Icon size={20} aria-hidden="true" />{roleLabel(url,label)}</Link>)}</details>
        </nav>
        <div className="sidebar-bottom">
          <div
            className="profile-menu"
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setProfileOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && profileOpen) {
                event.preventDefault();
                event.stopPropagation();
                setProfileOpen(false);
                event.currentTarget
                  .querySelector<HTMLButtonElement>(".profile-trigger")
                  ?.focus();
              }
            }}
          >
            <button
              type="button"
              className="account-summary profile-trigger"
              aria-expanded={profileOpen}
              aria-controls="profile-actions"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <span className="avatar" aria-hidden="true">
                {d.user.name.charAt(0)}
              </span>
              <span className="profile-identity">
                <strong>{d.user.name}</strong>
                <small>
                  {admin
                    ? "Thesis coordinator"
                    : faculty
                      ? "Faculty member"
                      : "Student"}
                </small>
              </span>
              <ChevronDown
                size={20}
                aria-hidden="true"
                className={
                  profileOpen ? "profile-chevron expanded" : "profile-chevron"
                }
              />
            </button>
            {profileOpen && (
              <div id="profile-actions" className="profile-actions">
                <Link href="/security" className="button">Authenticator</Link>
                <Link href="/account" className="button">Change password</Link>
                <SignOutButton className="account" icon />
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu aria-hidden="true" />
              <span>Menu</span>
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            {d.terms.length > 0 && <span className="term-chip">
              {d.terms[0]?.year} <span>· {d.terms[0]?.semester}</span>
            </span>}
            <Link
              className="bell"
              href="/notifications"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span>Notifications</span>
              {d.notifications.some((n: Data) => !n.read) && <i />}
            </Link>
            <div
              className="header-themes"
              role="group"
              aria-label="Color theme"
            >
              {(
                [
                  ["light", Sun],
                  ["dark", Moon],
                  ["system", Monitor],
                ] as const
              ).map(([mode, Icon]) => (
                <button
                  type="button"
                  key={mode}
                  aria-label={mode + " theme"}
                  title={
                    mode === "light"
                      ? "Light mode"
                      : mode === "dark"
                        ? "Dark mode"
                        : "Use system theme"
                  }
                  aria-pressed={theme === mode}
                  onClick={() => setTheme(mode)}
                >
                  <Icon size={20} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </header>
        <main className="content" id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>{path === "/" ? `Hello, ${d.user.name.split(" ")[0]}` : page}</h1>
              {path === "/" && <p>{admin ? "Your college’s defense schedule, in one place." : "Your group, available times, and defense schedule."}</p>}
            </div>
            <div className="heading-actions">
              {path === "/" && admin && (
                <>
                  <Link className="button primary" href="/drafts">
                    <Sparkles size={17} />
                    Generate schedule
                  </Link>
                </>
              )}
              {path === "/" && !admin && (
                <>
                  <Link className="button primary" href="/availability">
                    <Clock3 size={20} aria-hidden="true" />
                    My availability
                  </Link>
                </>
              )}
              {path === "/groups" && admin && (
                <button className="primary" onClick={groupForm}>
                  <Plus size={17} />
                  New group
                </button>
              )}
              {path === "/calendar" && <><Link className="button" href="/reports"><Download size={18} />Download schedule</Link>{admin && <Link className="button primary" href="/drafts"><Plus size={18} />Create schedule</Link>}</>}

            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {success && (
            <div className="success" role="status">
              <Check size={18} />
              {success}
            </div>
          )}
          {path === "/" && <SimpleHome d={d} />}
          {path === "/accounts" && admin && <Accounts d={d} action={action} busy={busy} edit={(u) => open("Manage account", "editUser", [
            { name: "name", label: "Full name", value: u.name },
            { name: "email", label: "Email", type: "email", value: u.email },
            ...(u.role === "STUDENT" ? [{ name: "number", label: "Student number", value: u.student?.number }] : []),
            { name: "password", label: "New temporary password (optional)", type: "password", required: false, hint: "At least 12 characters. Their authenticator stays connected." },
          ], { id: u.id })} />}
          {["/groups", "/faculty", "/rooms", "/calendar", "/waiting"].includes(
            path,
          ) && (
            <div className="search-box">
              <Search size={18} />
              <input
                aria-label="Search records"
                placeholder="Search by name, group, title, or location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>
                {path === "/groups"
                  ? groups.length + " groups"
                  : "WORKSPACE RECORDS"}
              </span>
            </div>
          )}
          {path === "/groups" && (
            <>
              <div className="info-strip">
                <Users size={19} />
                <span>
                  Review the group, then approve it for scheduling.
                </span>
              </div>
              <div className="group-grid">
                {filtered(
                  groups,
                  (g) =>
                    g.code +
                    " " +
                    g.title +
                    " " +
                    g.memberships
                      .map((m: Data) => m.student.user.name)
                      .join(" "),
                ).map((g) => (
                  <section className="panel group-card" key={g.id}>
                    <div className="group-card-head">
                      <Badge>{g.code}</Badge>
                      <span>
                        {g.section.program.name} · {g.section.name}
                      </span>
                    </div>
                    <h2>{g.title}</h2>
                    <p>
                      {g.term.year} · {g.term.semester} · {g.course}
                    </p>
                    <div className="member-list">
                      {g.memberships
                        .filter((m: Data) => m.active)
                        .map((m: Data) => (
                          <span key={m.id}>
                            <span className="avatar tiny">
                              {m.student.user.name.charAt(0)}
                            </span>
                            {m.student.user.name}
                            <small>{m.student.number}</small>
                          </span>
                        ))}
                    </div>
                    <div className="committee">
                      <small>ADVISER</small>
                      <strong>
                        {g.assignments
                          .filter((a: Data) => a.role === "ADVISER")
                          .map((a: Data) => a.faculty.user.name)
                          .join(", ") || "Not assigned"}
                      </strong>
                      <small>PANEL & CHAIR</small>
                      <p>
                        {g.assignments
                          .filter((a: Data) => a.role === "PANELIST")
                          .map(
                            (a: Data) =>
                              a.faculty.user.name +
                              (g.assignments.some(
                                (b: Data) =>
                                  b.role === "CHAIR" &&
                                  b.facultyId === a.facultyId,
                              )
                                ? " (chair)"
                                : ""),
                          )
                          .join(", ") || "Not assigned"}
                      </p>
                    </div>
                    {g.attempts.map((a: Data) => (
                      <div className="attempt-row" key={a.id}>
                        <div>
                          <strong>
                            {
                              d.stages.find((s: Data) => s.id === a.stageId)
                                ?.name
                            }{" "}
                            · attempt {a.number}
                          </strong>
                          <Badge
                            tone={a.readiness === "READY" ? "green" : "amber"}
                          >
                            {a.readiness === "READY" ? "Ready to schedule" : a.readiness === "REQUESTED" ? "Awaiting review" : "Not submitted"}
                          </Badge>
                        </div>
                        <div className="row-actions">
                          {!admin && !faculty && a.readiness === "PENDING" && <button
                            disabled={busy}
                            onClick={() =>
                              action("readiness", {
                                attemptId: a.id,
                                status: "REQUESTED",
                              })
                            }
                          >
                            Submit for review
                          </button>}
                          {(admin ||
                            (faculty &&
                              g.assignments.some(
                                (a: Data) =>
                                  a.role === "ADVISER" &&
                                  a.faculty.user.id === d.user.id,
                              ) &&
                              d.rules.facultyCanApprove)) && (
                            <button
                              onClick={() =>
                                action("readiness", {
                                  attemptId: a.id,
                                  status:
                                    a.readiness === "READY"
                                      ? "PENDING"
                                      : "READY",
                                })
                              }
                            >
                              {a.readiness === "READY"
                                ? "Revoke approval"
                                : "Approve ready"}
                            </button>
                          )}
                          {admin && (
                            <details><summary>Priority</summary><button
                              onClick={() =>
                                open(
                                  "Set approved priority",
                                  "priority",
                                  [
                                    {
                                      name: "priority",
                                      label:
                                        "Priority (higher scheduled first)",
                                      type: "number",
                                      value: a.priority,
                                    },
                                  ],
                                  { attemptId: a.id },
                                )
                              }
                            >
                              Change priority
                            </button></details>
                          )}
                        </div>
                      </div>
                    ))}
                    {admin && (
                      <details className="group-manage"><summary>Manage group</summary><div className="card-actions">
                        <button
                          onClick={() =>
                            open(
                              "Edit group details",
                              "groupDetails",
                              [
                                {
                                  name: "title",
                                  label: "Thesis title",
                                  type: "textarea",
                                  value: g.title,
                                },
                                {
                                  name: "sectionId",
                                  label: "Section",
                                  options: options(
                                    d.sections,
                                    (s) => s.program.name + " · " + s.name,
                                  ),
                                  value: g.sectionId,
                                },
                                {
                                  name: "attendees",
                                  label: "Additional attendees",
                                  type: "number",
                                  value: g.attendees,
                                },
                              ],
                              { id: g.id },
                            )
                          }
                        >
                          Edit details
                        </button>
                        <button
                          onClick={() =>
                            open("Remove a member", "removeMember", [
                              {
                                name: "membershipId",
                                label: "Member",
                                options: options(
                                  g.memberships.filter((m: Data) => m.active),
                                  (m) => m.student.user.name,
                                ),
                              },
                              { name: "reason", label: "Reason" },
                            ])
                          }
                        >
                          Remove member
                        </button>
                        <button
                          onClick={() =>
                            open(
                              "Assign defense committee",
                              "assign",
                              [
                                {
                                  name: "adviserId",
                                  label: "Adviser",
                                  options: facultyOpts,
                                },
                                {
                                  name: "panelIds",
                                  label: `Panelists (${d.rules.panelists} required)`,
                                  type: "multi",
                                  options: facultyOpts,
                                },
                                {
                                  name: "chairId",
                                  label: "Panel chair",
                                  options: [
                                    { value: "", label: "No chair" },
                                    ...facultyOpts,
                                  ],
                                  required: d.rules.chairRequired,
                                },
                              ],
                              { groupId: g.id },
                            )
                          }
                        >
                          Assign faculty
                        </button>
                        <button
                          onClick={() =>
                            open(
                              "Add group member",
                              "member",
                              [
                                {
                                  name: "studentId",
                                  label: "Student",
                                  options: options(
                                    d.students,
                                    (s) => s.number + " · " + s.user.name,
                                  ),
                                },
                              ],
                              { groupId: g.id },
                            )
                          }
                        >
                          Add member
                        </button>
                        <button
                          onClick={() =>
                            open(
                              "Create stage or repeat attempt",
                              "attempt",
                              [
                                {
                                  name: "stageId",
                                  label: "Stage",
                                  options: stageOpts,
                                },
                              ],
                              { groupId: g.id },
                            )
                          }
                        >
                          New attempt
                        </button>
                        <button
                          onClick={() =>
                            open(
                              "Archive completed thesis group",
                              "archiveGroup",
                              [{ name: "reason", label: "Reason" }],
                              { groupId: g.id },
                            )
                          }
                        >
                          Archive
                        </button>
                      </div></details>
                    )}
                  </section>
                ))}
              </div>
              {!groups.length && (
                <Empty>
                  No thesis groups yet. Your coordinator can add your group and
                  members.
                </Empty>
              )}

            </>
          )}
          {path === "/faculty" && (
            <>
              <div className="info-strip">
                <ShieldCheck size={19} />
                <span>
                  Advising capacity, defense workload, and acceptance preference
                  are independent. A full adviser can still attend existing
                  defenses.
                </span>
              </div>
              <div className="group-grid">
                {filtered(admin ? d.faculty : d.faculty.filter((f: Data) => f.userId === d.user.id), (f) => f.user.name).map((f) => {
                  const load = f.load,
                    today = local(new Date()),
                    daySessions = sessions.filter(
                      (s: Data) =>
                        s.status !== "CANCELLED" &&
                        s.status !== "DRAFT" &&
                        local(s.start) === today &&
                        s.participants.some((p: Data) => p.userId === f.userId),
                    );
                  return (
                    <section className="panel faculty-card" key={f.id}>
                      <div className="faculty-top">
                        <span className="avatar large">
                          {f.user.name
                            .split(" ")
                            .map((s: string) => s[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <h2>{f.user.name}</h2>
                          <p>{f.user.email}</p>
                        </div>
                      </div>
                      <Badge tone={f.accepting ? "green" : "amber"}>
                        {f.accepting
                          ? "Accepting new advisees"
                          : "Not accepting new advisees"}
                      </Badge>
                      <div className="load-line">
                        <span>Advising load</span>
                        <strong>
                          {load} / {f.capacity} {f.capacityUnit.toLowerCase()}
                        </strong>
                      </div>
                      <div className="progress">
                        <i
                          style={{
                            width:
                              Math.min(100, (load / f.capacity) * 100) + "%",
                          }}
                        />
                      </div>
                      <div className="load-line">
                        <span>Remaining advising capacity</span>
                        <strong>{Math.max(0, f.capacity - load)}</strong>
                      </div>
                      <div className="load-line">
                        <span>Defense workload today</span>
                        <strong>
                          {daySessions.length} / {f.dailyLimit} sessions
                        </strong>
                      </div>
                      <p className="muted">
                        Weekly maximum: {f.weeklyLimit ?? "Not set"} · Calendar
                        availability is checked for each selected interval.
                      </p>
                      {admin && (
                        <button
                          className="secondary"
                          onClick={() =>
                            open(
                              "Approved faculty limits",
                              "facultyLimits",
                              [
                                {
                                  name: "capacity",
                                  label: "Advising limit",
                                  type: "number",
                                  value: f.capacity,
                                },
                                {
                                  name: "capacityUnit",
                                  label: "Advising counting unit",
                                  options: [
                                    { value: "GROUPS", label: "Active groups" },
                                    {
                                      value: "STUDENTS",
                                      label: "Active students",
                                    },
                                  ],
                                  value: f.capacityUnit,
                                },
                                {
                                  name: "dailyLimit",
                                  label: "Defenses per day",
                                  type: "number",
                                  value: f.dailyLimit,
                                },
                                {
                                  name: "weeklyLimit",
                                  label: "Defenses per week (optional)",
                                  type: "number",
                                  value: f.weeklyLimit,
                                  required: false,
                                },
                              ],
                              { id: f.id },
                            )
                          }
                        >
                          Edit approved limits
                        </button>
                      )}
                      {f.userId === d.user.id && (
                        <div className="card-actions">
                          <button
                            onClick={() =>
                              action("accepting", { accepting: !f.accepting })
                            }
                          >
                            Change acceptance preference
                          </button>
                          <button
                            onClick={() =>
                              open(
                                "Request capacity change",
                                "request",
                                [
                                  {
                                    name: "details",
                                    label: "Requested limit and reason",
                                    type: "textarea",
                                  },
                                ],
                                { kind: "CAPACITY" },
                              )
                            }
                          >
                            Request capacity change
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {path === "/availability" && <SimpleAvailability d={d} action={action} busy={busy} />}
          {path === "/rooms" && (
            <>
              {admin && (
                <div className="toolbar">
                  <button
                    className="primary"
                    onClick={() =>
                      open("Add defense room", "room", [
                        { name: "name", label: "Room name / number" },
                        { name: "building", label: "Building" },
                        { name: "location", label: "Floor and directions" },
                        {
                          name: "capacity",
                          label: "Seating capacity",
                          type: "number",
                        },
                      ])
                    }
                  >
                    <Plus size={17} />
                    Add room
                  </button>
                  <Link className="button secondary" href="/availability">
                    Manage room hours
                  </Link>
                </div>
              )}
              <div className="group-grid">
                {filtered(d.rooms, (r) => r.name + r.building + r.location).map(
                  (r) => (
                    <section className="panel room-card" key={r.id}>
                      <div className="room-art">
                        <DoorOpen size={54} />
                        <Badge tone={r.active ? "green" : "red"}>
                          {r.active ? "Active venue" : "Unavailable"}
                        </Badge>
                      </div>
                      <h2>{r.name}</h2>
                      <p>{r.building}</p>
                      <strong>{r.location}</strong>
                      <div className="load-line">
                        <span>Seating capacity</span>
                        <strong>{r.capacity} people</strong>
                      </div>
                      {admin && (
                        <button
                          className="secondary"
                          onClick={() =>
                            open(
                              "Edit room",
                              "room",
                              [
                                {
                                  name: "name",
                                  label: "Room name",
                                  value: r.name,
                                },
                                {
                                  name: "building",
                                  label: "Building",
                                  value: r.building,
                                },
                                {
                                  name: "location",
                                  label: "Full location",
                                  value: r.location,
                                },
                                {
                                  name: "capacity",
                                  label: "Capacity",
                                  type: "number",
                                  value: r.capacity,
                                },
                                {
                                  name: "active",
                                  label: "Active venue",
                                  type: "checkbox",
                                  value: r.active,
                                },
                              ],
                              { id: r.id },
                            )
                          }
                        >
                          Edit room
                        </button>
                      )}
                    </section>
                  ),
                )}
              </div>
            </>
          )}
          {path === "/drafts" && admin && (!d.terms.length || !d.stages.length || !groups.length || !d.rooms.some((r: Data) => r.active)) && <section className="panel"><h2>Finish setup before creating a schedule</h2><p>Add your college records, a thesis group, and an active room first.</p><div className="toolbar"><Link className="button" href="/settings">College setup</Link><Link className="button" href="/groups">Thesis groups</Link><Link className="button" href="/rooms">Rooms</Link></div></section>}
          {path === "/drafts" && admin && !!d.terms.length && !!d.stages.length && !!groups.length && d.rooms.some((r: Data) => r.active) && (
            <>
              <div className="two-columns">
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Create a draft</h2>
                      <p>Choose the dates and rooms.</p>
                    </div>
                    <Sparkles size={23} />
                  </div>
                  <form
                    className="form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      action("generate", {
                        termId: f.get("termId"),
                        stageId: f.get("stageId"),
                        from: f.get("from"),
                        to: f.get("to"),
                        rooms: f.getAll("rooms"),
                        attemptIds: f.getAll("attemptIds"),
                      });
                    }}
                  >
                    <label>
                      Academic term
                      <select name="termId">
                        {d.terms.map((t: Data) => (
                          <option value={t.id} key={t.id}>
                            {t.year} · {t.semester}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Defense stage
                      <select name="stageId">
                        {d.stages.map((s: Data) => (
                          <option value={s.id} key={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      From
                      <input
                        name="from"
                        type="date"
                        defaultValue={d.rules.startDate}
                        required
                      />
                    </label>
                    <label>
                      Through
                      <input
                        name="to"
                        type="date"
                        defaultValue={d.rules.endDate}
                        required
                      />
                    </label>
                    <fieldset className="span-two choice-list"><legend>Rooms</legend>{d.rooms.filter((r: Data) => r.active).map((r: Data) => <label className="check-label" key={r.id}><input type="checkbox" name="rooms" value={r.id} defaultChecked />{r.name} · {r.capacity} seats</label>)}{!d.rooms.length && <Link href="/rooms" className="text-link">Add a room first</Link>}</fieldset>
                    <details className="span-two"><summary>Choose specific groups (optional)</summary><div className="choice-list">{attempts.map((a: Data) => <label className="check-label" key={a.id}><input type="checkbox" name="attemptIds" value={a.id} />{a.group.code} · {d.stages.find((s: Data) => s.id === a.stageId)?.name}</label>)}</div></details>
                    <button disabled={busy} className="primary span-two">
                      <Sparkles size={17} />
                      {busy
                        ? "Checking constraints…"
                        : "Generate proposed schedule"}
                    </button>
                  </form>
                </section>
                <section className="panel review-note">
                  <LockKeyhole size={30} />
                  <h2>Publish your schedule</h2>
                  <p>
                    Check the draft below, then publish it for everyone to see.
                  </p>
                  <details><summary>Scheduling rules</summary><ul>
                    <li>Published sessions stay fixed.</li>
                    <li>Locked drafts survive regeneration.</li>
                    <li>Publication rechecks current records atomically.</li>
                    <li>Only publication sends official notifications.</li>
                  </ul></details>
                  <div className="metric-row">
                    <span>
                      <strong>{drafts.length}</strong>proposed sessions
                    </span>
                    <span>
                      <strong>
                        {drafts.reduce(
                          (n: number, s: Data) =>
                            n + s.snapshot.students.length,
                          0,
                        )}
                      </strong>
                      students accommodated
                    </span>
                  </div>
                  <button
                    disabled={busy || !drafts.length}
                    className="primary"
                    onClick={() =>
                      action("publish", { ids: drafts.map((s: Data) => s.id) })
                    }
                  >
                    <ShieldCheck size={17} />
                    Publish all draft sessions
                  </button>
                  <a className="text-link" href="/api/reports?draft=true">
                    Download DRAFT PDF <Download size={15} />
                  </a>
                </section>
              </div>
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Draft review</h2>
                    <p>Every edit uses the same scheduling constraints.</p>
                  </div>
                  <Badge>{drafts.length} PROPOSALS</Badge>
                </div>
                {scheduleTable(drafts)}
              </section>
              <details className="panel"><summary>Check teacher workload</summary>
                <div className="panel-title">
                  <h2>Workload after proposed scheduling</h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Faculty member</th>
                        <th>Date</th>
                        <th>Sessions (including drafts)</th>
                        <th>Daily limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.faculty.flatMap((f: Data) =>
                        [
                          ...new Set(
                            sessions
                              .filter(
                                (s: Data) =>
                                  s.status !== "CANCELLED" &&
                                  s.participants.some(
                                    (p: Data) => p.userId === f.userId,
                                  ),
                              )
                              .map((s: Data) => local(s.start)),
                          ),
                        ].map((date: any) => (
                          <tr key={f.id + date}>
                            <td>{f.user.name}</td>
                            <td>{date}</td>
                            <td>
                              {
                                sessions.filter(
                                  (s: Data) =>
                                    s.status !== "CANCELLED" &&
                                    local(s.start) === date &&
                                    s.participants.some(
                                      (p: Data) => p.userId === f.userId,
                                    ),
                                ).length
                              }
                            </td>
                            <td>{f.dailyLimit}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
          {path === "/calendar" && (
            <>
              <div className="toolbar">
                <Badge tone="green">PUBLISHED SCHEDULES</Badge>
                <button
                  className="secondary"
                  onClick={() =>
                    open(
                      "Request a schedule change",
                      "request",
                      [
                        {
                          name: "details",
                          label:
                            "Group, current schedule, proposed change, and reason",
                          type: "textarea",
                        },
                      ],
                      { kind: "SCHEDULE_CHANGE" },
                    )
                  }
                >
                  Request change
                </button>

              </div>
              <section className="panel">
                <details><summary>Day-by-day view</summary><div className="calendar-agenda">
                  {[...new Set(published.map((s: Data) => local(s.start)))].map(
                    (date: any) => (
                      <div className="agenda-day" key={date}>
                        <div>
                          <strong>{local(date + "T04:00Z", "dd")}</strong>
                          <span>{local(date + "T04:00Z", "MMM · EEE")}</span>
                        </div>
                        <div>
                          {published
                            .filter((s: Data) => local(s.start) === date)
                            .map((s: Data) => (
                              <div className="agenda-event" key={s.id}>
                                <span>{local(s.start, "hh:mm a")}</span>
                                <strong>
                                  {s.snapshot.code} · {s.snapshot.title}
                                </strong>
                                <small>
                                  {s.snapshot.room.name} ·{" "}
                                  {s.snapshot.room.building} ·{" "}
                                  {s.snapshot.room.location}
                                </small>
                              </div>
                            ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
                </details>
                {scheduleTable(
                  sessions.filter((s: Data) => s.status !== "DRAFT"),
                )}
              </section>
            </>
          )}
          {path === "/waiting" && admin && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Every group stays visible.</h2>
                  <p>Hard constraints are never exceeded to fill a slot.</p>
                </div>
                <Badge tone="amber">{waiting.length} WAITING</Badge>
              </div>
              {filtered(
                waiting,
                (a) => a.group.code + a.group.title + (a.waitingReason ?? ""),
              ).map((a) => (
                <div className="waiting-row" key={a.id}>
                  <span className="icon-tile amber-tile">
                    <TriangleAlert size={20} />
                  </span>
                  <div>
                    <strong>
                      {a.group.code} · {a.group.title}
                    </strong>
                    <p>
                      {a.waitingReason ||
                        (a.readiness !== "READY"
                          ? "Group not yet approved for defense. Ask the adviser or coordinator to review readiness."
                          : "Not yet included in a generated draft. Check committee assignments and collect availability.")}
                    </p>
                    <small>
                      {d.stages.find((s: Data) => s.id === a.stageId)?.name} ·{" "}
                      {a.readiness}
                    </small>
                  </div>
                  <Link href="/groups" aria-label={`Review ${a.group.code}`}>
                    <ArrowUpRight size={20} />
                  </Link>
                </div>
              ))}
              {!waiting.length && (
                <Empty>Every eligible group has a session.</Empty>
              )}
            </section>
          )}
          {path === "/reports" && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Download a schedule</h2>
                  <p>Choose a report, then preview or download.</p>
                </div>
                <FileText size={27} />
              </div>
              <form
                className="report-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const q = new URLSearchParams(
                    Object.fromEntries(
                      Object.entries(report).filter(([, v]) => v !== ""),
                    ) as any,
                  );
                  q.set("format", "json");
                  const r = await fetch("/api/reports?" + q);
                  const data = await r.json();
                  if (r.ok) setRoster(data);
                  else setError(data.error);
                }}
              >
                <div className="form-grid">
                  <label>
                    Report type
                    <select
                      value={report.type}
                      onChange={(e) =>
                        setReport({ ...report, type: e.target.value })
                      }
                    >
                      {(admin
                        ? ["master", "roster", "faculty", "room", "group"]
                        : faculty
                          ? ["faculty", "group", "roster"]
                          : ["group", "roster"]
                      ).map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)} schedule /
                          list
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Group
                    <select
                      onChange={(e) =>
                        setReport({ ...report, group: e.target.value })
                      }
                    >
                      <option value="">All authorized groups</option>
                      {groupOpts.map((o) => (
                        <option value={o.value} key={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {[
                    { name: "from", label: "From date", type: "date" },
                    { name: "to", label: "Through date", type: "date" },
                    {
                      name: "program",
                      label: "Program",
                      options: d.programs.map((p: Data) => ({
                        value: p.name,
                        label: p.name,
                      })),
                    },
                    {
                      name: "section",
                      label: "Section",
                      options: d.sections.map((s: Data) => ({
                        value: s.name,
                        label: s.name,
                      })),
                    },
                    {
                      name: "faculty",
                      label: "Faculty",
                      options: options(d.faculty, (f) => f.user.name).map(
                        (o: Data) => ({
                          ...o,
                          value: d.faculty.find((f: Data) => f.id === o.value)
                            .userId,
                        }),
                      ),
                    },
                    { name: "room", label: "Room", options: options(d.rooms) },
                    {
                      name: "stage",
                      label: "Stage",
                      options: d.stages.map((s: Data) => ({
                        value: s.name,
                        label: s.name,
                      })),
                    },
                    {
                      name: "version",
                      label: "Published version (blank = current)",
                      type: "number",
                    },
                  ].map((f) => (
                    <label key={f.name}>
                      {f.label}
                      {f.options ? (
                        <select
                          onChange={(e) =>
                            setReport({ ...report, [f.name]: e.target.value })
                          }
                        >
                          <option value="">All / current</option>
                          {f.options.map((o: Data) => (
                            <option value={o.value} key={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type}
                          min="1"
                          onChange={(e) =>
                            setReport({ ...report, [f.name]: e.target.value })
                          }
                        />
                      )}
                    </label>
                  ))}
                  {admin && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        onChange={(e) =>
                          setReport({
                            ...report,
                            draft: e.target.checked ? "true" : "",
                          })
                        }
                      />
                      Export draft proposals (watermarked DRAFT)
                    </label>
                  )}
                </div>
                <div className="toolbar">
                  <button className="primary">Preview student list</button>
                  <a
                    className="button secondary"
                    href={
                      "/api/reports?" +
                      new URLSearchParams(
                        Object.fromEntries(
                          Object.entries(report).filter(([, v]) => v !== ""),
                        ) as any,
                      )
                    }
                  >
                    <Download size={16} />
                    Download PDF
                  </a>
                  <a
                    className="button secondary"
                    href={
                      "/api/reports?" +
                      new URLSearchParams({
                        ...Object.fromEntries(
                          Object.entries(report).filter(([, v]) => v !== ""),
                        ),
                        format: "csv",
                      } as any)
                    }
                  >
                    Export student CSV
                  </a>
                </div>
              </form>
              {roster && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Group</th>
                        <th>Date & time</th>
                        <th>Location</th>
                        <th>Version</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.flatMap((r) =>
                        r.students.map((s: Data) => (
                          <tr key={r.sessionId + s.id}>
                            <td>{s.name}</td>
                            <td>
                              {r.code}
                              <small>{r.title}</small>
                            </td>
                            <td>
                              {r.date}
                              <small>
                                {r.start} – {r.end}
                              </small>
                            </td>
                            <td>
                              {r.room.name}
                              <small>
                                {r.room.building} · {r.room.location}
                              </small>
                            </td>
                            <td>
                              {r.status} · v{r.version}
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                  {!roster.length && (
                    <Empty>No authorized sessions match your filters.</Empty>
                  )}
                </div>
              )}
            </section>
          )}
          {path === "/settings" && admin && (
            <>
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>College & defense rules</h2>
                    <p>
                      Set your college’s scheduling requirements.
                    </p>
                  </div>
                  <SlidersHorizontal size={23} />
                </div>
                <div className="toolbar">
                  <button onClick={() => open("College and defense dates", "settings", [
                    { name: "name", label: "College name", value: d.college.name },
                    { name: "startDate", label: "First defense date", type: "date", value: d.rules.startDate },
                    { name: "endDate", label: "Last defense date", type: "date", value: d.rules.endDate },
                    { name: "openTime", label: "Start time", type: "time", value: d.rules.openTime },
                    { name: "closeTime", label: "End time", type: "time", value: d.rules.closeTime },
                  ], { ...d.rules, name: d.college.name, logo: d.college.logo })}>Edit college and dates</button>
                  <button onClick={() => open("Defense requirements", "settings", [
                    { name: "buffer", label: "Break between defenses (minutes)", type: "number", value: d.rules.buffer },
                    { name: "panelists", label: "Number of panelists", type: "number", value: d.rules.panelists },
                    ...["chairRequired", "adviserRequired", "adviserAsPanelist", "facultyCanApprove"].map((name) => ({ name, label: ({chairRequired:"Require a panel chair", adviserRequired:"Require the adviser to attend", adviserAsPanelist:"Allow the adviser as a panelist", facultyCanApprove:"Allow advisers to approve readiness"} as Record<string,string>)[name], type: "checkbox", value: d.rules[name] })),
                  ], { ...d.rules, name: d.college.name, logo: d.college.logo })}>Defense requirements</button>
                  <Link className="button" href="/rooms">Manage rooms</Link>
                </div>
                <div className="settings-grid">
                  <span>
                    Timezone<strong>Asia/Manila</strong>
                  </span>
                  <span>
                    Defense hours
                    <strong>
                      {d.rules.openTime}–{d.rules.closeTime}
                    </strong>
                  </span>
                  <span>
                    Turnover buffer<strong>{d.rules.buffer} minutes</strong>
                  </span>
                  <span>
                    Panelists<strong>{d.rules.panelists} required</strong>
                  </span>
                  {d.stages.map((s: Data) => (
                    <span key={s.id}>
                      {s.name}
                      <strong>{s.duration} minutes</strong>
                      <button
                        onClick={() =>
                          open(
                            "Edit stage duration",
                            "stageDuration",
                            [
                              {
                                name: "duration",
                                label: "Duration in minutes",
                                type: "number",
                                value: s.duration,
                              },
                            ],
                            { id: s.id },
                          )
                        }
                      >
                        Edit
                      </button>
                    </span>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h2>Manage college records</h2>
                </div>
                <div className="toolbar">
                  <button
                    className="secondary"
                    onClick={() =>
                      open("Add program", "program", [
                        { name: "name", label: "Program name" },
                      ])
                    }
                  >
                    Add program
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      open("Add section", "section", [
                        { name: "name", label: "Section name" },
                        {
                          name: "programId",
                          label: "Program",
                          options: options(d.programs),
                        },
                      ])
                    }
                  >
                    Add section
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      open("Add term", "term", [
                        {
                          name: "year",
                          label: "Academic year",
                          value: "2026–2027",
                        },
                        {
                          name: "semester",
                          label: "Semester",
                          value: "First Semester",
                        },
                      ])
                    }
                  >
                    Add term
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      open("Add defense stage", "stage", [
                        { name: "name", label: "Stage name" },
                        {
                          name: "duration",
                          label: "Duration in minutes",
                          type: "number",
                          value: 45,
                        },
                      ])
                    }
                  >
                    Add defense stage
                  </button>
                </div>
                <p className="muted">
                  Programs: {d.programs.map((p: Data) => p.name).join(", ")} ·
                  Sections: {d.sections.map((s: Data) => s.name).join(", ")}
                </p>
              </section>
              <Requests d={d} action={action} />
              <details className="panel"><summary>View activity history</summary>
                <div className="panel-title">
                  <h2>Activity history</h2>
                  <Badge>LAST 100 EVENTS</Badge>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>When · PHT</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.events.map((e: Data) => (
                        <tr key={e.id}>
                          <td>{local(e.createdAt, "MMM d, hh:mm a")}</td>
                          <td>{e.actorId}</td>
                          <td>{e.action}</td>
                          <td className="audit-details">{e.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
          {path === "/notifications" && (
            <>
              <section className="panel">
                <div className="panel-title">
                  <h2>Updates for you</h2>
                  <Bell size={22} />
                </div>
                {d.notifications.map((n: Data) => (
                  <div className="notification" key={n.id}>
                    <span className="icon-tile">
                      <Bell size={18} />
                    </span>
                    <div>
                      <p>{n.message}</p>
                      <small>
                        {local(n.createdAt, "MMM d, yyyy · hh:mm a")}
                      </small>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => action("readNotification", { id: n.id })}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
                {!d.notifications.length && (
                  <Empty>
                    No notifications yet. Published schedules and changes will
                    appear here.
                  </Empty>
                )}
              </section>
              <Requests d={d} action={action} />
            </>
          )}
          {!admin && ["/settings", "/drafts", "/waiting"].includes(path) && (
            <div className="error">
              This workspace is restricted to the thesis coordinator.
            </div>
          )}
          <footer className="page-footer">
            <span>{d.college.name}</span>
            <span>Thesis Defense Scheduler · Asia/Manila</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <h2 id="modal-title">{modal.title}</h2>
              <button aria-label="Close dialog" onClick={() => setModal(null)}>
                <X size={21} />
              </button>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {modal.op === "history" ? (
              <div className="history-list">
                {modal.initial.history.length ? (
                  modal.initial.history.map((h: Data) => (
                    <div key={h.id}>
                      <Badge>VERSION {h.version}</Badge>
                      <p>{h.reason}</p>
                      <small>
                        {local(h.createdAt, "yyyy-MM-dd hh:mm a")} · {h.actorId}
                      </small>
                      <p>
                        {local(h.snapshot.start, "MMM d, hh:mm a")} ·{" "}
                        {h.snapshot.room.name}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>Drafts have no published versions yet.</p>
                )}
              </div>
            ) : (
              <form
                noValidate={modal.op === "group"}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (modal.op === "group") {
                    const controls = Array.from(e.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).filter((el) => !el.closest("[hidden]"));
                    if (controls.some((el) => !el.reportValidity())) return;
                  }
                  if (modal.op === "group" && formStep === 0) { setFormStep(1); return; }
                  const f = new FormData(e.currentTarget),
                    body = { ...modal.initial };
                  for (const field of modal.fields) {
                    const value = f.get(field.name);
                    body[field.name] =
                      field.type === "multi"
                        ? f.getAll(field.name)
                        : field.type === "checkbox"
                          ? value === "on"
                          : field.type === "number"
                            ? value === ""
                              ? null
                              : Number(value)
                            : value === "" &&
                                [
                                  "userId",
                                  "roomId",
                                  "date",
                                  "weekday",
                                  "effectiveFrom",
                                  "effectiveTo",
                                ].includes(field.name)
                              ? null
                              : field.name === "weekday" && value !== ""
                                ? Number(value)
                                : value;
                  }
                  const missing = modal.fields.find((field) => field.type === "multi" && field.required !== false && !f.getAll(field.name).length);
                  if (missing) { setError(`Choose at least one entry for ${missing.label}.`); return; }
                  action(modal.op, body);
                }}
              >
                {modal.op === "group" && <p className="form-step">Step {formStep + 1} of 2 · {formStep === 0 ? "Group details" : "Members and defense"}</p>}
                <div className="form-grid">
                  {modal.fields.map((f, index) => f.type === "multi" ? (
                    <fieldset key={f.name} hidden={modal.op === "group" && (formStep === 0 ? index >= 4 : index < 4)} className="span-two choice-list"><legend>{f.label}</legend>
                      {f.options?.length ? f.options.map((o) => <label className="check-label" key={o.value}><input type="checkbox" name={f.name} value={o.value} defaultChecked={(f.value ?? []).includes(o.value)} />{o.label}</label>) : <p>No records yet. Add them first.</p>}
                      {f.hint && <small>{f.hint}</small>}
                    </fieldset>
                  ) : (
                    <label key={f.name} hidden={modal.op === "group" && (formStep === 0 ? index >= 4 : index < 4)} className={f.type === "textarea" ? "span-two" : f.type === "checkbox" ? "check-label" : ""}>
                      {f.type !== "checkbox" && f.label}
                      {f.options ? <select aria-label={f.label} name={f.name} defaultValue={f.value} required={f.required !== false}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                      : f.type === "textarea" ? <textarea aria-label={f.label} name={f.name} defaultValue={f.value} required={f.required !== false} rows={3} />
                      : <input aria-label={f.label} autoFocus={modal.fields[0] === f} name={f.name} type={f.type ?? "text"} defaultValue={f.type === "checkbox" ? undefined : f.value ?? ""} defaultChecked={f.type === "checkbox" ? f.value : undefined} required={f.type !== "checkbox" && f.required !== false} min={f.type === "number" ? 0 : undefined} minLength={f.type === "password" ? 12 : undefined} />}
                      {f.type === "checkbox" && f.label}{f.hint && <small>{f.hint}</small>}
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  {modal.op === "group" && formStep === 1 && <button type="button" onClick={() => setFormStep(0)}>Back</button>}
                  <button className="primary" disabled={busy}>
                    {busy ? "Saving…" : modal.op === "group" && formStep === 0 ? "Next: members" : "Save"}
                    <Check size={16} />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Requests({
  d,
  action,
}: {
  d: Data;
  action: (op: string, d: Data) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Requests & preferences</h2>
        <Badge>
          {d.requests.filter((r: Data) => r.status === "OPEN").length} OPEN
        </Badge>
      </div>
      {d.requests.map((r: Data) => (
        <div className="notification" key={r.id}>
          <div>
            <Badge tone={r.status === "OPEN" ? "amber" : "green"}>
              {r.kind} · {r.status}
            </Badge>
            <p>{r.details}</p>
            <small>
              {r.user.name} · {local(r.createdAt, "MMM d, hh:mm a")}
            </small>
          </div>
          {d.user.role === "COORDINATOR" && r.status === "OPEN" && (
            <div className="row-actions">
              <button
                onClick={() =>
                  action("resolveRequest", { id: r.id, status: "RESOLVED" })
                }
              >
                Resolve
              </button>
              <button
                onClick={() =>
                  action("resolveRequest", { id: r.id, status: "DECLINED" })
                }
              >
                Decline
              </button>
            </div>
          )}
        </div>
      ))}
      {!d.requests.length && <p className="muted">No requests yet.</p>}
    </section>
  );
}
