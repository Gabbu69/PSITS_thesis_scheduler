import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { db } from "./db";
import { canSeeSession, type Actor } from "./access";
import { local } from "./constraints";
export type ReportRow = {
  sessionId: string;
  date: string;
  start: string;
  end: string;
  code: string;
  title: string;
  students: { id: string; name: string }[];
  program: string;
  section: string;
  term: string;
  stage: string;
  room: { id: string; name: string; building: string; location: string };
  adviser: { id: string; name: string }[];
  panel: { id: string; name: string }[];
  chair: { id: string; name: string }[];
  status: string;
  version: number;
};
export async function reportRows(
  u: Actor,
  filters: URLSearchParams,
): Promise<ReportRow[]> {
  const type = filters.get("type") ?? "master";
  if (!["master", "roster", "faculty", "room", "group"].includes(type))
    throw new Error("Invalid report type");
  if (u.role === "STUDENT" && !["group", "roster"].includes(type))
    throw new Error("FORBIDDEN");
  if (u.role === "FACULTY" && !["faculty", "group", "roster"].includes(type))
    throw new Error("FORBIDDEN");
  const drafts = filters.get("draft") === "true";
  if (drafts && u.role !== "COORDINATOR") throw new Error("FORBIDDEN");
  const sessions = await db.defenseSession.findMany({
    where: {
      status: drafts
        ? "DRAFT"
        : {
            in: filters.get("version")
              ? ["PUBLISHED", "COMPLETED", "CANCELLED"]
              : ["PUBLISHED", "COMPLETED"],
          },
      ...(u.role === "COORDINATOR"
        ? {}
        : { participants: { some: { userId: u.id } } }),
    },
    include: { participants: true, history: true },
    orderBy: { start: "asc" },
  });
  const rows: ReportRow[] = [];
  for (const s of sessions) {
    if (!canSeeSession(u, s)) continue;
    const requestedVersion = filters.get("version");
    const version = requestedVersion ? Number(requestedVersion) : s.version;
    const snap = (requestedVersion
      ? s.history.find((h) => h.version === version)?.snapshot
      : s.snapshot) as unknown as {
      start: string;
      end: string;
      groupId: string;
      code: string;
      title: string;
      students: { id: string; name: string }[];
      program: string;
      section: string;
      term: string;
      stage: string;
      room: ReportRow["room"];
      adviser: ReportRow["adviser"];
      panel: ReportRow["panel"];
      chair: ReportRow["chair"];
    };
    if (!snap) continue;
    // Historical reports also require membership in that published snapshot.
    if (
      u.role !== "COORDINATOR" &&
      ![...snap.students, ...snap.adviser, ...snap.panel, ...snap.chair].some(
        (p) => p.id === u.id,
      )
    )
      continue;
    const date = local(snap.start);
    if (
      (filters.get("from") && date < filters.get("from")!) ||
      (filters.get("to") && date > filters.get("to")!)
    )
      continue;
    if (filters.get("group") && snap.groupId !== filters.get("group")) continue;
    if (filters.get("program") && snap.program !== filters.get("program"))
      continue;
    if (filters.get("section") && snap.section !== filters.get("section"))
      continue;
    if (filters.get("stage") && snap.stage !== filters.get("stage")) continue;
    if (filters.get("room") && snap.room.id !== filters.get("room")) continue;
    if (
      filters.get("faculty") &&
      ![...snap.adviser, ...snap.panel, ...snap.chair].some(
        (p) => p.id === filters.get("faculty"),
      )
    )
      continue;
    rows.push({
      ...snap,
      sessionId: s.id,
      date,
      start: local(snap.start, "hh:mm a"),
      end: local(snap.end, "hh:mm a"),
      status: requestedVersion && version < s.version ? "PUBLISHED" : s.status,
      version,
    });
  }
  return rows;
}
const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 55,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111",
  },
  header: {
    position: "absolute",
    top: 28,
    left: 40,
    right: 40,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  college: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 9, marginTop: 5 },
  session: { marginBottom: 18 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 6 },
  line: { marginBottom: 4, lineHeight: 1.4 },
  student: { paddingLeft: 12, marginBottom: 3 },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#444",
    borderTopWidth: 0.5,
    paddingTop: 8,
  },
});
export async function pdfBuffer(
  college: string,
  rows: ReportRow[],
  type: string,
  draft = false,
) {
  const generated = local(new Date(), "yyyy-MM-dd hh:mm a");
  const shouldSplit = (row: ReportRow) =>
    row.students.length > 8 ||
    [
      row.title,
      row.term,
      row.stage,
      row.program,
      row.section,
      row.room.name,
      row.room.building,
      row.room.location,
      ...row.students.map((s) => s.name),
      ...row.adviser.map((p) => p.name),
      ...row.panel.map((p) => p.name),
      ...row.chair.map((p) => p.name),
    ].join("").length > 900;
  return renderToBuffer(
    <Document title={`${draft ? "DRAFT - " : ""}Thesis Defense Schedule`}>
      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.header}>
          <Text style={styles.college}>{college}</Text>
          <Text style={styles.sub}>
            {draft ? "DRAFT - FOR REVIEW ONLY" : "OFFICIAL PUBLISHED SCHEDULE"}{" "}
            · {type.toUpperCase()} · Asia/Manila
          </Text>
        </View>
        {!rows.length && (
          <Text>No authorized sessions match these filters.</Text>
        )}
        {rows.map((row) => (
          <View
            key={row.sessionId}
            style={styles.session}
            wrap={shouldSplit(row)}
          >
            <Text style={styles.title} minPresenceAhead={40}>
              {row.code} · {row.date} · {row.start} - {row.end}
            </Text>
            <Text style={styles.line}>{row.title}</Text>
            <Text style={styles.line}>
              {row.term} | {row.stage} | {row.program} · {row.section}
            </Text>
            <Text style={styles.line}>
              Location: {row.room.name}, {row.room.building},{" "}
              {row.room.location}
            </Text>
            <Text style={styles.line}>
              Adviser: {row.adviser.map((p) => p.name).join(", ")} | Chair:{" "}
              {row.chair.map((p) => p.name).join(", ") || "Not required"}
            </Text>
            <Text style={styles.line}>
              Panelists: {row.panel.map((p) => p.name).join(", ")}
            </Text>
            <Text style={styles.line} minPresenceAhead={20}>
              Students ({row.students.length}):
            </Text>
            {row.students.map((s, i) => (
              <Text key={s.id} style={styles.student}>
                {i + 1}. {s.name}
              </Text>
            ))}
            <Text style={styles.line}>
              Status: {row.status} | Schedule version: {row.version}
            </Text>
          </View>
        ))}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated ${generated} PHT | Page ${pageNumber} of ${totalPages} | ${draft ? "DRAFT" : "Published version details"}`
          }
        />
      </Page>
    </Document>,
  );
}
export function csvText(rows: ReportRow[]) {
  const quote = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^\s*[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const header = [
    "Group",
    "Title",
    "Student name",
    "Program",
    "Section",
    "Term",
    "Stage",
    "Date",
    "Start",
    "End",
    "Room",
    "Building",
    "Location",
    "Adviser",
    "Chair",
    "Panelists",
    "Status",
    "Version",
  ];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.flatMap((r) =>
        r.students.map((s) => [
          r.code,
          r.title,
          s.name,
          r.program,
          r.section,
          r.term,
          r.stage,
          r.date,
          r.start,
          r.end,
          r.room.name,
          r.room.building,
          r.room.location,
          r.adviser.map((p) => p.name).join("; "),
          r.chair.map((p) => p.name).join("; "),
          r.panel.map((p) => p.name).join("; "),
          r.status,
          r.version,
        ]),
      ),
    ]
      .map((r) => r.map(quote).join(","))
      .join("\r\n")
  );
}
