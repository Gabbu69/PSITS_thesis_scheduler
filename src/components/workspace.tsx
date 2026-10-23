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
  ArrowUpRight,
  Plus,
  Check,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Sparkles,
  GraduationCap,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Menu,
  X,
  Download,
  ShieldCheck,
  TriangleAlert,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { local } from "@/lib/constraints";
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
  ["/", "Overview", LayoutDashboard],
  ["/groups", "Thesis groups", GraduationCap],
  ["/faculty", "Faculty & workload", Users],
  ["/availability", "Availability", Clock3],
  ["/rooms", "Rooms & venues", DoorOpen],
  ["/drafts", "Schedule workspace", Sparkles],
  ["/calendar", "Published schedule", CalendarDays],
  ["/notifications", "Notifications", Bell],
  ["/waiting", "Waiting list", TriangleAlert],
  ["/reports", "Reports & exports", FileText],
  ["/settings", "Settings & history", SlidersHorizontal],
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
  const [navigationScroll, setNavigationScroll] = useState({
    overflow: false,
    atEnd: false,
  });
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
    const update = () => {
      const overflow =
        navigation.clientHeight > 0 &&
        navigation.scrollHeight > navigation.clientHeight + 2;
      const atEnd =
        navigation.scrollTop + navigation.clientHeight >=
        navigation.scrollHeight - 4;
      setNavigationScroll((previous) =>
        previous.overflow === overflow && previous.atEnd === atEnd
          ? previous
          : { overflow, atEnd },
      );
    };
    const observer = new ResizeObserver(() => {
      showActive();
      update();
    });
    observer.observe(navigation);
    navigation.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      navigation.removeEventListener("scroll", update);
    };
  }, [path, data?.user.role, mobile]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = document.getElementById("workspace-navigation");
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
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
  async function action(op: string, body: Data) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, data: body }),
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
    } catch (e) {
      setError((e as Error).message);
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
  const visibleNav = nav.filter(
    ([p]) => admin || !["/drafts", "/settings", "/waiting"].includes(p),
  );
  const page = nav.find((n) => n[0] === path)?.[1] ?? "Overview";
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
  const windowForm = () =>
    open(
      "Add availability or blocked period",
      "availability",
      [
        ...(admin
          ? [
              {
                name: "userId",
                label: "Person (leave blank for room / college block)",
                options: [
                  { value: "", label: "No person" },
                  ...options([
                    ...d.faculty.map((f: Data) => f.user),
                    ...d.students.map((s: Data) => s.user),
                  ]),
                ],
                required: false,
              },
              {
                name: "roomId",
                label: "Room (leave blank for person / college block)",
                options: [{ value: "", label: "No room" }, ...options(d.rooms)],
                required: false,
              },
            ]
          : []),
        {
          name: "kind",
          label: "Type",
          options: [
            { value: "AVAILABLE", label: "Available" },
            {
              value: "BLOCK",
              label: "Unavailable / class / meeting / holiday",
            },
          ],
        },
        {
          name: "date",
          label: "Specific date (overrides recurring availability)",
          type: "date",
          required: false,
        },
        {
          name: "weekday",
          label: "Or recurring weekday",
          options: [
            { value: "", label: "Use specific date" },
            ...[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((label, i) => ({ value: String(i), label })),
          ],
          required: false,
        },
        {
          name: "effectiveFrom",
          label: "Recurring effective from",
          type: "date",
          required: false,
        },
        {
          name: "effectiveTo",
          label: "Recurring effective through",
          type: "date",
          required: false,
        },
        {
          name: "startTime",
          label: "Start time (PHT)",
          type: "time",
          value: "08:00",
        },
        {
          name: "endTime",
          label: "End time (PHT)",
          type: "time",
          value: "17:00",
        },
        { name: "label", label: "Label / class / reason", required: false },
      ],
      admin ? {} : { userId: d.user.id },
    );
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
                      {s.status} · v{s.version}
                    </Badge>
                    {s.locked && <small>Locked draft</small>}
                    {s.attention && <Badge tone="amber">Requires review</Badge>}
                  </td>
                  <td>
                    <div className="row-actions">
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
                    </div>
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
        <div className="college-label">COLLEGE WORKSPACE</div>
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
              {label}
              {url === "/waiting" && waiting.length > 0 && (
                <span className="nav-count">{waiting.length}</span>
              )}
            </Link>
          ))}
        </nav>
        {navigationScroll.overflow && (
          <button
            type="button"
            className="nav-more"
            onClick={() => {
              const navigation =
                document.querySelector<HTMLElement>(".sidebar nav");
              if (navigation)
                navigation.scrollTop = navigationScroll.atEnd
                  ? 0
                  : navigation.scrollTop + navigation.clientHeight * 0.8;
            }}
          >
            {navigationScroll.atEnd ? (
              <ArrowUp size={18} aria-hidden="true" />
            ) : (
              <ArrowDown size={18} aria-hidden="true" />
            )}
            {navigationScroll.atEnd ? "Back to first pages" : "More pages"}
          </button>
        )}
        <div className="sidebar-bottom">
          <div className="help-card">
            <ShieldCheck size={23} />
            <strong>Better together.</strong>
            <p>
              Shared availability.
              <br />A smoother defense day.
            </p>
          </div>
          <div className="theme-switch" role="group" aria-label="Color theme">
            {[
              ["light", Sun],
              ["dark", Moon],
              ["system", Monitor],
            ].map(([value, Icon]: any) => (
              <button
                key={value}
                aria-label={`${value} theme`}
                title={`${value} theme`}
                aria-pressed={theme === value}
                className={theme === value ? "selected" : ""}
                onClick={() => setTheme(value)}
              >
                <Icon size={20} aria-hidden="true" />
                <span>
                  {value === "system"
                    ? "System"
                    : value === "light"
                      ? "Light"
                      : "Dark"}
                </span>
              </button>
            ))}
          </div>
          <div className="account-summary">
            <span className="avatar" aria-hidden="true">
              {d.user.name.charAt(0)}
            </span>
            <span>
              <strong>{d.user.name}</strong>
              <small>
                {admin
                  ? "Thesis coordinator"
                  : faculty
                    ? "Faculty member"
                    : "Student"}
              </small>
            </span>
          </div>
          <button
            className="account"
            onClick={async () => {
              await fetch("/api/auth/sign-out", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              location.href = "/login";
            }}
          >
            <LogOut size={20} aria-hidden="true" />
            Sign out
          </button>
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
            <span className="term-chip">
              {d.terms[0]?.year} <span>· {d.terms[0]?.semester}</span>
            </span>
            <Link
              className="bell"
              href="/notifications"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span>Notifications</span>
              {d.notifications.some((n: Data) => !n.read) && <i />}
            </Link>
            <span className="avatar small">{d.user.name.charAt(0)}</span>
          </div>
        </header>
        <main className="content" id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {admin
                  ? "COORDINATOR WORKSPACE"
                  : faculty
                    ? "FACULTY WORKSPACE"
                    : "STUDENT WORKSPACE"}
              </span>
              <h1>
                {path === "/"
                  ? `Let’s make room for progress.`
                  : page === "Overview" && path === "/notifications"
                    ? "Your notifications"
                    : page}
              </h1>
              <p>
                {path === "/"
                  ? "A shared view of your college’s thesis defense journey."
                  : "Coordinate confidently. All dates and times are in Asia/Manila."}
              </p>
            </div>
            <div className="heading-actions">
              {path === "/" && admin && (
                <>
                  <Link className="button secondary" href="/reports">
                    <Download size={16} />
                    Export reports
                  </Link>
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
                  <Link className="button secondary" href="/calendar">
                    <CalendarDays size={20} aria-hidden="true" />
                    My defense schedule
                  </Link>
                </>
              )}
              {path === "/groups" && admin && (
                <button className="primary" onClick={groupForm}>
                  <Plus size={17} />
                  New group
                </button>
              )}
              {path === "/availability" && (
                <button className="primary" onClick={windowForm}>
                  <Plus size={17} />
                  Add availability
                </button>
              )}
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
          {path === "/" && (
            <>
              <section className="hero-panel">
                <div>
                  <Badge tone="hero">A CLEARER PATH TO DEFENSE DAY</Badge>
                  <h2>
                    Less chasing schedules.
                    <br />
                    More moving forward.
                  </h2>
                  <p>
                    Find the overlap. Bring everyone together.
                    <br />
                    Make your next defense day work for everyone.
                  </p>
                  <Link
                    href={admin ? "/drafts" : "/availability"}
                    className="hero-link"
                  >
                    {admin
                      ? "Open schedule workspace"
                      : "Share your availability"}
                    <ArrowRight size={17} />
                  </Link>
                </div>
                <div className="hero-graphic" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="floating-icon">
                    <GraduationCap size={28} />
                  </div>
                  <div className="mini-calendar">
                    <div className="mini-calendar-head">
                      NOVEMBER <CalendarDays size={17} />
                    </div>
                    <div className="mini-days">
                      {["M", "T", "W", "T", "F"].map((n, i) => (
                        <span key={i}>{n}</span>
                      ))}
                      {Array.from({ length: 15 }, (_, i) => (
                        <span
                          className={
                            [3, 7, 11].includes(i) ? "day-highlight" : ""
                          }
                          key={i + 5}
                        >
                          {i + 2}
                          {[3, 7, 11].includes(i) && <i />}
                        </span>
                      ))}
                    </div>
                    <div className="mini-label">
                      <span className="green-dot" /> Everyone, on the same page.
                    </div>
                  </div>
                  <div className="graphic-tag">
                    <Check size={16} />
                    One shared schedule
                  </div>
                </div>
              </section>
              <div className="stats-grid">
                {[
                  [
                    "Thesis groups",
                    groups.length,
                    GraduationCap,
                    "Across your workspace",
                  ],
                  [
                    "Individual students",
                    new Set(
                      groups.flatMap((g: Data) =>
                        g.memberships
                          .filter((m: Data) => m.active)
                          .map((m: Data) => m.studentId),
                      ),
                    ).size,
                    Users,
                    "Every member accounted for",
                  ],
                  [
                    "Approved & ready",
                    groups.filter((g: Data) =>
                      g.attempts.some((a: Data) => a.readiness === "READY"),
                    ).length,
                    ShieldCheck,
                    "Ready for scheduling",
                  ],
                  [
                    "Published defenses",
                    published.length,
                    CalendarDays,
                    `${new Set(published.map((s: Data) => s.snapshot.groupId)).size} groups scheduled · ${new Set(waiting.map((a: Data) => a.group.id)).size} waiting`,
                  ],
                ].map(([label, value, Icon, caption]: any) => (
                  <section className="stat-card" key={label}>
                    <div className="stat-top">
                      <span>{label}</span>
                      <Icon size={20} />
                    </div>
                    <strong>{value.toString().padStart(2, "0")}</strong>
                    <small>{caption}</small>
                  </section>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Your next steps</h2>
                      <p>A little coordination goes a long way.</p>
                    </div>
                    <Badge>WORKFLOW</Badge>
                  </div>
                  <div className="workflow">
                    {(admin
                      ? [
                          [
                            "01",
                            "Add your records",
                            "Students, groups, and committee assignments.",
                            "/groups",
                          ],
                          [
                            "02",
                            "Find common availability",
                            "Collect available times in one shared place.",
                            "/availability",
                          ],
                          [
                            "03",
                            "Review, then publish",
                            "Approve readiness and confirm a conflict-free draft.",
                            "/drafts",
                          ],
                          [
                            "04",
                            "Share defense day details",
                            "Export schedules with the full room location.",
                            "/reports",
                          ],
                        ]
                      : [
                          [
                            "01",
                            "Share your availability",
                            "Add available times and class or meeting conflicts.",
                            "/availability",
                          ],
                          [
                            "02",
                            "Check your defense schedule",
                            "See published dates, times, and room locations.",
                            "/calendar",
                          ],
                          [
                            "03",
                            faculty
                              ? "Review your assigned groups"
                              : "Review your thesis group",
                            faculty
                              ? "Check advisees and committee assignments."
                              : "Check your members, thesis details, and readiness.",
                            "/groups",
                          ],
                          [
                            "04",
                            "Read your updates",
                            "View schedule changes and coordinator notices.",
                            "/notifications",
                          ],
                        ]
                    ).map(([n, title, desc, url]) => (
                      <Link href={url} key={n} className="workflow-row">
                        <span className="step-number">{n}</span>
                        <span>
                          <strong>{title}</strong>
                          <small>{desc}</small>
                        </span>
                        <ArrowUpRight size={18} />
                      </Link>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Scheduling pulse</h2>
                      <p>Readiness and capacity at a glance.</p>
                    </div>
                    <span className="icon-tile small-tile">
                      <Clock3 size={19} />
                    </span>
                  </div>
                  <div className="pulse-chart">
                    <div
                      className="donut"
                      style={
                        {
                          "--progress": `${attempts.length ? Math.round((published.length / attempts.length) * 100) : 0}%`,
                        } as React.CSSProperties
                      }
                    >
                      <div>
                        <strong>{published.length}</strong>
                        <span>published</span>
                      </div>
                    </div>
                    <div className="legend">
                      <span>
                        <i className="dot blue-dot" />
                        Draft sessions <strong>{drafts.length}</strong>
                      </span>
                      <span>
                        <i className="dot green-dot" />
                        Published <strong>{published.length}</strong>
                      </span>
                      <span>
                        <i className="dot amber-dot" />
                        Waiting <strong>{waiting.length}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="capacity-note">
                    <Users size={17} />
                    <span>
                      {
                        d.faculty.filter((f: Data) => f.load >= f.capacity)
                          .length
                      }{" "}
                      faculty at advising capacity
                    </span>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Upcoming defenses</h2>
                    <p>
                      The published plan, with everyone and every room accounted
                      for.
                    </p>
                  </div>
                  <Link href="/calendar" className="text-link">
                    View schedule <ArrowRight size={15} />
                  </Link>
                </div>
                {scheduleTable(
                  published
                    .filter((s: Data) => new Date(s.end) > new Date())
                    .slice(0, 5),
                )}
              </section>
              <div className="demo-note">
                Fictional demonstration records · Editable sample rules · No
                official college policy implied
              </div>
            </>
          )}
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
                  Each group receives one defense session. Readiness approval
                  and schedule publication are separate steps.
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
                            {a.readiness}
                          </Badge>
                        </div>
                        <div className="row-actions">
                          <button
                            onClick={() =>
                              action("readiness", {
                                attemptId: a.id,
                                status: "REQUESTED",
                              })
                            }
                          >
                            Request review
                          </button>
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
                            <button
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
                              Priority
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {admin && (
                      <div className="card-actions">
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
                      </div>
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
              {admin && (
                <section className="panel">
                  <div className="panel-title">
                    <h2>Student directory</h2>
                    <Badge>{d.students.length} STUDENTS</Badge>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student identifier</th>
                          <th>Full name</th>
                          <th>Email</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered(
                          d.students,
                          (s) => s.number + s.user.name,
                        ).map((s) => (
                          <tr key={s.id}>
                            <td>{s.number}</td>
                            <td>{s.user.name}</td>
                            <td>{s.user.email}</td>
                            <td>
                              <button
                                onClick={() =>
                                  open(
                                    "Edit student record",
                                    "editUser",
                                    [
                                      {
                                        name: "name",
                                        label: "Full name",
                                        value: s.user.name,
                                      },
                                      {
                                        name: "email",
                                        label: "Email",
                                        type: "email",
                                        value: s.user.email,
                                      },
                                      {
                                        name: "number",
                                        label: "Student identifier",
                                        value: s.number,
                                      },
                                      {
                                        name: "password",
                                        label:
                                          "Reset password (optional, 12+ characters)",
                                        type: "password",
                                        required: false,
                                      },
                                    ],
                                    { id: s.userId },
                                  )
                                }
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
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
                {filtered(d.faculty, (f) => f.user.name).map((f) => {
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
          {path === "/availability" && (
            <>
              <div className="info-strip">
                <Clock3 size={20} />
                <span>
                  Share when you are available, then add classes or exceptions.
                  A date-specific available range replaces that day’s recurring
                  availability. Blocks always take priority.
                </span>
              </div>
              <div className="availability-summary panel">
                <h2>Availability submission</h2>
                <p>
                  {admin
                    ? "Review faculty, student, and room availability before generating a draft."
                    : d.windows.some(
                          (w: Data) =>
                            w.userId === d.user.id && w.kind === "AVAILABLE",
                        )
                      ? "Your availability has been submitted. Add date-specific exceptions when your plans change."
                      : "Availability not submitted. Add at least one available interval to be considered for scheduling."}
                </p>
                <div className="week-strip">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, i) => (
                      <div key={day}>
                        <strong>{day}</strong>
                        {d.windows
                          .filter((w: Data) => w.weekday === i)
                          .map((w: Data) => (
                            <span
                              className={w.kind === "BLOCK" ? "blocked" : ""}
                              key={w.id}
                            >
                              {w.startTime}–{w.endTime}
                              <small>
                                {w.kind === "BLOCK" ? "Blocked" : "Available"}
                              </small>
                            </span>
                          ))}
                      </div>
                    ),
                  )}
                </div>
              </div>
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Available times & exceptions</h2>
                    <p>
                      Includes the time needed for room turnover after each
                      defense.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      open(
                        "Suggest a preferred defense slot",
                        "request",
                        [
                          {
                            name: "details",
                            label: "Preferred date, time, room, and reason",
                            type: "textarea",
                          },
                        ],
                        { kind: "PREFERRED_SLOT" },
                      )
                    }
                  >
                    Suggest a preferred slot
                  </button>
                </div>
                {d.windows.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Person / resource</th>
                          <th>Applies on</th>
                          <th>Time · PHT</th>
                          <th>Type & note</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {d.windows.map((w: Data) => (
                          <tr key={w.id}>
                            <td>
                              {w.userId === d.user.id
                                ? "You"
                                : (d.faculty.find(
                                    (f: Data) => f.userId === w.userId,
                                  )?.user.name ??
                                  d.students.find(
                                    (s: Data) => s.userId === w.userId,
                                  )?.user.name ??
                                  d.rooms.find((r: Data) => r.id === w.roomId)
                                    ?.name ??
                                  "College-wide")}
                            </td>
                            <td>
                              {w.date ??
                                [
                                  "Sunday",
                                  "Monday",
                                  "Tuesday",
                                  "Wednesday",
                                  "Thursday",
                                  "Friday",
                                  "Saturday",
                                ][w.weekday]}
                              {w.weekday !== null && (
                                <small>
                                  {w.effectiveFrom || "Any date"} →{" "}
                                  {w.effectiveTo || "No end"}
                                </small>
                              )}
                            </td>
                            <td>
                              {w.startTime}–{w.endTime}
                            </td>
                            <td>
                              <Badge
                                tone={w.kind === "BLOCK" ? "amber" : "green"}
                              >
                                {w.kind}
                              </Badge>
                              <small>{w.label}</small>
                            </td>
                            <td>
                              {(admin || w.userId === d.user.id) && (
                                <button
                                  onClick={() =>
                                    action("removeAvailability", { id: w.id })
                                  }
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>
                    Availability not submitted. Use “Add availability” to share
                    your dates.
                  </Empty>
                )}
              </section>
            </>
          )}
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
          {path === "/drafts" && admin && (
            <>
              <div className="two-columns">
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Build a proposed schedule</h2>
                      <p>
                        Assigned committees. Common availability. No hard-limit
                        overrides.
                      </p>
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
                    <label className="span-two">
                      Available rooms
                      <select
                        name="rooms"
                        multiple
                        defaultValue={d.rooms
                          .filter((r: Data) => r.active)
                          .map((r: Data) => r.id)}
                      >
                        {d.rooms.map((r: Data) => (
                          <option key={r.id} value={r.id}>
                            {r.name} · {r.capacity} seats
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="span-two">
                      Eligible groups (optional selection; blank uses all in
                      term/stage)
                      <select multiple name="attemptIds">
                        {attempts.map((a: Data) => (
                          <option key={a.id} value={a.id}>
                            {a.group.code} ·{" "}
                            {
                              d.stages.find((s: Data) => s.id === a.stageId)
                                ?.name
                            }{" "}
                            · {a.readiness}
                          </option>
                        ))}
                      </select>
                    </label>
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
                  <h2>You have the final say.</h2>
                  <p>
                    Drafts are proposals. Review dates, locations, participants,
                    and workloads before publication.
                  </p>
                  <ul>
                    <li>Published sessions stay fixed.</li>
                    <li>Locked drafts survive regeneration.</li>
                    <li>Publication rechecks current records atomically.</li>
                    <li>Only publication sends official notifications.</li>
                  </ul>
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
              <section className="panel">
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
              </section>
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
                <Link className="button secondary" href="/reports">
                  <Download size={16} />
                  Download schedule
                </Link>
              </div>
              <section className="panel">
                <div className="calendar-agenda">
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
                  <h2>Print the plan. Share the details.</h2>
                  <p>
                    Exports use authorized database records and retain published
                    student and location snapshots.
                  </p>
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
                      These are editable demonstration settings, not official
                      college policy.
                    </p>
                  </div>
                  <SlidersHorizontal size={23} />
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    open("Configure college and rules", "settings", [
                      {
                        name: "name",
                        label: "College name",
                        value: d.college.name,
                      },
                      {
                        name: "logo",
                        label: "Logo path in public folder",
                        value: d.college.logo,
                      },
                      {
                        name: "startDate",
                        label: "Scheduling start",
                        type: "date",
                        value: d.rules.startDate,
                      },
                      {
                        name: "endDate",
                        label: "Scheduling end",
                        type: "date",
                        value: d.rules.endDate,
                      },
                      {
                        name: "openTime",
                        label: "College opening time",
                        type: "time",
                        value: d.rules.openTime,
                      },
                      {
                        name: "closeTime",
                        label: "College closing time",
                        type: "time",
                        value: d.rules.closeTime,
                      },
                      {
                        name: "buffer",
                        label: "Turnover buffer in minutes",
                        type: "number",
                        value: d.rules.buffer,
                      },
                      {
                        name: "panelists",
                        label: "Required panelists",
                        type: "number",
                        value: d.rules.panelists,
                      },
                      ...[
                        "chairRequired",
                        "adviserRequired",
                        "adviserAsPanelist",
                        "facultyCanApprove",
                      ].map((name) => ({
                        name,
                        label: (
                          {
                            chairRequired: "Panel chair required",
                            adviserRequired: "Adviser attendance required",
                            adviserAsPanelist: "Adviser may count as panelist",
                            facultyCanApprove: "Advisers may approve readiness",
                          } as any
                        )[name],
                        type: "checkbox",
                        value: d.rules[name],
                      })),
                    ])
                  }
                >
                  Edit college rules
                </button>
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
                      open("Create user account", "user", [
                        { name: "name", label: "Full name" },
                        { name: "email", label: "Email", type: "email" },
                        {
                          name: "password",
                          label: "Temporary password (12+ characters)",
                          type: "password",
                        },
                        {
                          name: "role",
                          label: "Role",
                          options: [
                            { value: "STUDENT", label: "Student" },
                            { value: "FACULTY", label: "Faculty" },
                            { value: "COORDINATOR", label: "Coordinator" },
                          ],
                        },
                        {
                          name: "number",
                          label: "Student identifier (required for students)",
                          required: false,
                        },
                      ])
                    }
                  >
                    Add user / student
                  </button>
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
              <section className="panel">
                <div className="panel-title">
                  <h2>Audit history</h2>
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
              </section>
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
                onSubmit={(e) => {
                  e.preventDefault();
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
                  action(modal.op, body);
                }}
              >
                <div className="form-grid">
                  {modal.fields.map((f) => (
                    <label
                      className={
                        ["textarea", "multi"].includes(f.type ?? "")
                          ? "span-two"
                          : f.type === "checkbox"
                            ? "check-label"
                            : ""
                      }
                      key={f.name}
                    >
                      {f.type !== "checkbox" && f.label}
                      {f.options ? (
                        <select
                          name={f.name}
                          multiple={f.type === "multi"}
                          defaultValue={
                            f.value ?? (f.type === "multi" ? [] : undefined)
                          }
                          required={f.required !== false}
                        >
                          {f.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : f.type === "textarea" ? (
                        <textarea
                          name={f.name}
                          defaultValue={f.value}
                          required={f.required !== false}
                          rows={3}
                        />
                      ) : (
                        <input
                          autoFocus={modal.fields[0] === f}
                          name={f.name}
                          type={f.type ?? "text"}
                          defaultValue={
                            f.type === "checkbox" ? undefined : (f.value ?? "")
                          }
                          defaultChecked={
                            f.type === "checkbox" ? f.value : undefined
                          }
                          required={
                            f.type !== "checkbox" && f.required !== false
                          }
                          min={f.type === "number" ? 0 : undefined}
                        />
                      )}
                      {f.type === "checkbox" && f.label}
                      {f.type === "multi" && (
                        <small>
                          Hold Ctrl / Command to select multiple entries.
                        </small>
                      )}
                      {f.hint && <small>{f.hint}</small>}
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
                  <button className="primary" disabled={busy}>
                    {busy ? "Validating…" : "Save & validate"}
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
