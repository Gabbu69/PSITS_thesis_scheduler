-- CreateTable
CREATE TABLE "ClassTimetable" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClassTimetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTimetableRevision" (
    "id" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "publisherId" TEXT,

    CONSTRAINT "ClassTimetableRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMeeting" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "ClassMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassTimetable_facultyId_termId_key" ON "ClassTimetable"("facultyId", "termId");

-- CreateIndex
CREATE INDEX "ClassTimetableRevision_status_idx" ON "ClassTimetableRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTimetableRevision_timetableId_number_key" ON "ClassTimetableRevision"("timetableId", "number");

-- CreateIndex
CREATE INDEX "ClassMeeting_revisionId_idx" ON "ClassMeeting"("revisionId");

-- AddForeignKey
ALTER TABLE "ClassTimetable" ADD CONSTRAINT "ClassTimetable_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTimetable" ADD CONSTRAINT "ClassTimetable_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTimetableRevision" ADD CONSTRAINT "ClassTimetableRevision_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "ClassTimetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTimetableRevision" ADD CONSTRAINT "ClassTimetableRevision_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMeeting" ADD CONSTRAINT "ClassMeeting_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ClassTimetableRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
