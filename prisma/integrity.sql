-- Applied as part of the initial migration, after Prisma's generated table DDL.
CREATE UNIQUE INDEX "Membership_one_active_student_course_term"
ON "Membership" ("studentId", "termId", "course") WHERE "active" = true;
CREATE UNIQUE INDEX "DefenseSession_one_active_attempt"
ON "DefenseSession" ("attemptId") WHERE "status" <> 'CANCELLED';
CREATE UNIQUE INDEX "Assignment_one_adviser_per_group" ON "Assignment" ("groupId") WHERE "role"='ADVISER';
CREATE UNIQUE INDEX "Assignment_one_chair_per_group" ON "Assignment" ("groupId") WHERE "role"='CHAIR';

ALTER TABLE "User" ADD CONSTRAINT "User_valid_role" CHECK ("role" IN ('COORDINATOR','FACULTY','STUDENT'));
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_valid_role" CHECK ("role" IN ('ADVISER','PANELIST','CHAIR'));
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_positive_limits" CHECK ("capacity">0 AND "dailyLimit">0 AND ("weeklyLimit" IS NULL OR "weeklyLimit">0) AND "capacityUnit" IN ('GROUPS','STUDENTS'));
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_positive_duration" CHECK ("duration">0);
ALTER TABLE "Room" ADD CONSTRAINT "Room_positive_capacity" CHECK ("capacity">0);
ALTER TABLE "ThesisGroup" ADD CONSTRAINT "Group_nonnegative_attendees" CHECK ("attendees">=0);
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_valid_state" CHECK ("readiness" IN ('PENDING','REQUESTED','READY') AND "number">0 AND "priority">=0);
ALTER TABLE "DefenseSession" ADD CONSTRAINT "Session_valid_interval" CHECK ("start"<"end" AND "version">=0 AND "status" IN ('DRAFT','PUBLISHED','COMPLETED','CANCELLED'));
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_valid_scope" CHECK (NOT ("userId" IS NOT NULL AND "roomId" IS NOT NULL) AND ("userId" IS NOT NULL OR "roomId" IS NOT NULL OR "kind"='BLOCK'));
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_valid_interval" CHECK ("kind" IN ('AVAILABLE','BLOCK') AND "startTime"<"endTime" AND (("date" IS NOT NULL AND "weekday" IS NULL) OR ("date" IS NULL AND "weekday" BETWEEN 0 AND 6)));
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_valid_role" CHECK ("role" IN ('FACULTY','STUDENT'));
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "College" ADD CONSTRAINT "College_singleton" CHECK ("id"=1 AND "timezone"='Asia/Manila');
ALTER TABLE "Rules" ADD CONSTRAINT "Rules_valid_settings" CHECK ("id"=1 AND "buffer">=0 AND "panelists">0 AND "openTime"<"closeTime" AND "startDate"<="endDate");

-- Membership scope must agree with its parent group even for direct SQL writes.
CREATE FUNCTION check_membership_scope() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ThesisGroup" WHERE "id"=NEW."groupId" AND "termId"=NEW."termId" AND "course"=NEW."course") THEN
    RAISE EXCEPTION 'Membership term and course must match the thesis group';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER membership_scope BEFORE INSERT OR UPDATE ON "Membership" FOR EACH ROW EXECUTE FUNCTION check_membership_scope();
