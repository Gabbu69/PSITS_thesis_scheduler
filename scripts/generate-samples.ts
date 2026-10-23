import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { reportRows, pdfBuffer } from "../src/lib/reports";
try {
  const college = await db.college.findUniqueOrThrow({ where: { id: 1 } });
  if (!college.name.includes("Fictional"))
    throw new Error("Sample export is only for the fictional demo database");
  const admin = { id: "coordinator", name: "Alex Rivera", role: "COORDINATOR" };
  const master = await reportRows(admin, new URLSearchParams());
  const group = master.filter((r) => r.code === "PSITS-001");
  await mkdir("output/pdf", { recursive: true });
  await mkdir("tmp", { recursive: true });
  await writeFile(
    "output/pdf/sample-master-schedule.pdf",
    await pdfBuffer(college.name, master, "master"),
  );
  await writeFile(
    "output/pdf/sample-group-schedule.pdf",
    await pdfBuffer(college.name, group, "group"),
  );
  const stress = {
    ...group[0],
    code: "FICTIONAL-LAYOUT-STRESS",
    title:
      "A deliberately long fictional research title for verifying line wrapping and readable page breaks. ".repeat(
        5,
      ),
    students: Array.from({ length: 100 }, (_, i) => ({
      id: "stress-" + i,
      name: `Fictional Roster Member ${String(i + 1).padStart(3, "0")}`,
    })),
  };
  await writeFile(
    "tmp/long-roster-stress.pdf",
    await pdfBuffer(college.name, [stress], "layout test", true),
  );
  console.log(
    "Generated two database-backed sample PDFs and a temporary 100-member layout stress fixture.",
  );
} finally {
  await db.$disconnect();
}
