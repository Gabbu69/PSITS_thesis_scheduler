import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
const db = new PrismaClient();
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error("Set DEMO_PASSWORD to at least 12 characters");
async function user(id: string, name: string, role: string, number?: string) {
  return db.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name,
      email: id + "@demo.psits.test",
      role,
      emailVerified: true,
      accounts: {
        create: {
          id: "account-" + id,
          accountId: id,
          providerId: "credential",
          password: await hashPassword(password!),
        },
      },
      ...(role === "FACULTY"
        ? { faculty: { create: { id: "faculty-" + id } } }
        : role === "STUDENT"
          ? { student: { create: { id: "student-" + id, number: number! } } }
          : {}),
    },
  });
}
async function seed() {
  if (await db.college.count()) {
    console.log(
      "Database already contains records. Seed skipped (non-destructive).",
    );
    return;
  }
  await db.college.create({
    data: { id: 1, name: "College of Computing · Fictional Demo" },
  });
  await db.rules.create({ data: { id: 1 } });
  await user("coordinator", "Alex Rivera", "COORDINATOR");
  for (const [id, name] of [
    ["faculty", "Dr. Elena Reyes"],
    ["santos", "Prof. Marco Santos"],
    ["cruz", "Dr. Sofia Cruz"],
    ["lim", "Prof. Adrian Lim"],
    ["garcia", "Dr. Mia Garcia"],
  ])
    await user(id, name, "FACULTY");
  await db.program.create({
    data: {
      id: "bsit",
      name: "BS Information Technology",
      sections: { create: { id: "bsit-4a", name: "4A" } },
    },
  });
  await db.program.create({
    data: {
      id: "bscs",
      name: "BS Computer Science",
      sections: { create: { id: "bscs-4a", name: "4A" } },
    },
  });
  await db.term.create({
    data: { id: "term-2026", year: "2026–2027", semester: "First Semester" },
  });
  for (const [id, name] of [
    ["title", "Title Defense"],
    ["proposal", "Proposal Defense"],
    ["final", "Final Defense"],
  ])
    await db.stage.create({ data: { id, name, duration: 45 } });
  await db.room.createMany({
    data: [
      {
        id: "room-1",
        name: "Innovation Room 201",
        building: "Computing Building",
        location: "Second floor, east wing, beside faculty lounge",
        capacity: 24,
      },
      {
        id: "room-2",
        name: "Research Lab 103",
        building: "Computing Building",
        location: "Ground floor, north entrance",
        capacity: 18,
      },
      {
        id: "room-3",
        name: "Seminar Room 302",
        building: "Academic Building",
        location: "Third floor, across the library",
        capacity: 30,
        active: false,
      },
    ],
  });
  const titles = [
    "Campus Resource Borrowing and Return System",
    "Community Crop Damage Monitoring Dashboard",
    "Offline Student Budget and Expense Tracker",
    "Accessible Campus Navigation Companion",
    "Local Market Price Information System",
    "Clinic Appointment and Queue Management",
    "Library Seat Reservation and Occupancy System",
    "Small Business Inventory and Sales Tracker",
    "Disaster Preparedness Learning Portal",
    "Research Consultation Booking Platform",
    "Community Document Request Tracker",
    "Smart Classroom Equipment Inventory",
  ];
  const studentNames = [
    "Jamie Dela Rosa",
    "Sam Mendoza",
    "Taylor Aquino",
    "Morgan Flores",
    "Riley Navarro",
    "Casey Bautista",
    "Jordan Ramos",
    "Avery Villanueva",
    "Drew Castillo",
    "Quinn Torres",
    "Robin Fernandez",
    "Charlie Lopez",
    "Alexis Domingo",
    "Sky Perez",
    "Cameron Tan",
    "Reese Santiago",
    "Parker Diaz",
    "Sage Gonzales",
  ];
  let studentIndex = 0;
  for (let i = 0; i < 12; i++) {
    const members = [];
    const count = i === 0 ? 3 : i < 6 ? 2 : 1;
    for (let j = 0; j < count; j++) {
      const id = studentIndex === 0 ? "student" : "student" + studentIndex;
      await user(
        id,
        studentNames[studentIndex] ?? `Demo Student ${studentIndex + 1}`,
        "STUDENT",
        `DEMO-2026-${String(studentIndex + 1).padStart(3, "0")}`,
      );
      members.push("student-" + id);
      studentIndex++;
    }
    await db.thesisGroup.create({
      data: {
        id: "group-" + (i + 1),
        code: "PSITS-" + String(i + 1).padStart(3, "0"),
        title: titles[i],
        termId: "term-2026",
        sectionId: i % 3 === 0 ? "bscs-4a" : "bsit-4a",
        memberships: {
          create: members.map((studentId) => ({
            studentId,
            termId: "term-2026",
            course: "THESIS",
          })),
        },
        assignments: {
          create: [
            {
              facultyId: i < 8 ? "faculty-faculty" : "faculty-garcia",
              role: "ADVISER",
            },
            ...["santos", "cruz", "lim"]
              .filter((_, n) => (i === 10 ? n < 2 : true))
              .map((f) => ({ facultyId: "faculty-" + f, role: "PANELIST" })),
            { facultyId: "faculty-santos", role: "CHAIR" },
          ],
        },
        attempts: {
          create: {
            id: "attempt-" + (i + 1),
            stageId: "proposal",
            readiness: i === 11 ? "PENDING" : "READY",
            readyAt:
              i === 11
                ? null
                : new Date(
                    `2026-10-${String(10 + i).padStart(2, "0")}T00:00:00Z`,
                  ),
            priority: i === 0 ? 1 : 0,
          },
        },
      },
    });
  }
  // Monday-Friday availability. All required members must submit; the last group intentionally has none.
  const users = await db.user.findMany({
    where: { role: { not: "COORDINATOR" } },
  });
  for (const u of users) {
    const membership = await db.membership.findFirst({
      where: { student: { userId: u.id } },
    });
    if (membership?.groupId === "group-12") continue;
    for (let weekday = 1; weekday <= 5; weekday++)
      await db.availability.create({
        data: {
          userId: u.id,
          kind: "AVAILABLE",
          weekday,
          effectiveFrom: "2026-11-02",
          effectiveTo: "2026-11-30",
          startTime: "08:00",
          endTime: "17:00",
          label: "Fictional submitted availability",
        },
      });
  }
  for (const roomId of ["room-1", "room-2"])
    for (let weekday = 1; weekday <= 5; weekday++)
      await db.availability.create({
        data: {
          roomId,
          kind: "AVAILABLE",
          weekday,
          startTime: "08:00",
          endTime: "17:00",
        },
      });
  await db.availability.createMany({
    data: [
      {
        userId: "santos",
        kind: "BLOCK",
        date: "2026-11-02",
        startTime: "10:00",
        endTime: "12:00",
        label: "Fictional teaching conflict",
      },
      {
        roomId: "room-2",
        kind: "BLOCK",
        date: "2026-11-02",
        startTime: "08:00",
        endTime: "17:00",
        label: "Fictional room maintenance",
      },
      {
        kind: "BLOCK",
        date: "2026-11-04",
        startTime: "12:00",
        endTime: "13:00",
        label: "Fictional college meeting",
      },
    ],
  });
  await db.auditEvent.create({
    data: {
      actorId: "coordinator",
      action: "DEMO_SEED",
      details:
        "All names, research topics, and scheduling records are fictional. No official policy implied.",
    },
  });
  console.log(
    "Fictional demo seeded: 12 groups, 19 students, 5 faculty. Demo accounts: coordinator / faculty / student @demo.psits.test.",
  );
}
seed().finally(() => db.$disconnect());
