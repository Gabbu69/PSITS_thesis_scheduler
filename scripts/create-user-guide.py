"""Create the public PSITS usage guide. No credentials or personal records are read."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/PSITS_Thesis_Scheduler_User_Guide.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("ArialBold", "C:/Windows/Fonts/arialbd.ttf"))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="ArialBold", italic="Arial", boldItalic="ArialBold")
W, H = A4
M, CW = 44, W - 88
NAVY = colors.HexColor("#14364d")
BLUE = colors.HexColor("#146c99")
INK = colors.HexColor("#173149")
MUTED = colors.HexColor("#526779")
LINE = colors.HexColor("#dfe8ef")
SOFT = colors.HexColor("#edf5fa")
WHITE = colors.white
URL = "https://psits-thesis-scheduler.vercel.app"
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle("PSITS Thesis Scheduler - User Guide")
c.setAuthor("PSITS Thesis Scheduler")
c.setSubject("Student, teacher and coordinator instructions with authenticator setup and sign-out confirmation")
PAGE = 0
lowest = []

def para(text, x, y, width=CW, size=10.5, leading=15, color=INK, bold=False):
    style = ParagraphStyle("body", fontName="ArialBold" if bold else "Arial", fontSize=size, leading=leading, textColor=color)
    p = Paragraph(text, style)
    _, height = p.wrap(width, H)
    p.drawOn(c, x, y - height)
    lowest.append(y - height)
    return y - height

def page(section, title, subtitle):
    global PAGE
    if PAGE:
        c.showPage()
    PAGE += 1
    c.setFillColor(NAVY)
    c.rect(0, H - 98, W, 98, fill=1, stroke=0)
    c.drawImage(str(ROOT / "public/logo.jpg"), M, H - 70, 36, 36, mask="auto")
    para("PSITS", M + 47, H - 37, 200, 13, 15, WHITE, True)
    para("THESIS SCHEDULER", M + 47, H - 55, 250, 9, 12, colors.HexColor("#c5dce9"))
    para(section.upper(), W - M - 200, H - 42, 200, 9, 12, colors.HexColor("#c5dce9"))
    c.setStrokeColor(LINE)
    c.line(M, 48, W - M, 48)
    para("PSITS USER GUIDE  |  25 OCTOBER 2026", M, 36, CW - 60, 8, 10, MUTED)
    para(f"{PAGE} / 8", W - M - 32, 36, 40, 8, 10, MUTED)
    c.bookmarkPage(f"page-{PAGE}")
    c.addOutlineEntry(title, f"page-{PAGE}", level=0)
    y = para(title, M, H - 125, CW, 25, 29, NAVY, True) - 11
    y = para(subtitle, M, y, CW, 11, 16, MUTED) - 22
    return y

def heading(text, y):
    return para(text, M, y, CW, 14, 19, NAVY, True) - 10

def step(n, title, body, y):
    c.setFillColor(SOFT)
    c.circle(M + 13, y - 13, 13, fill=1, stroke=0)
    c.setFont("ArialBold", 10)
    c.setFillColor(BLUE)
    c.drawCentredString(M + 13, y - 16, str(n))
    ty = para(title, M + 39, y, CW - 39, 12, 16, NAVY, True) - 5
    ty = para(body, M + 39, ty, CW - 39, 10.5, 15)
    return ty - 16

def box(title, body, y, bg=SOFT):
    style = ParagraphStyle("measure", fontName="Arial", fontSize=10.5, leading=15)
    p = Paragraph(body, style)
    _, ph = p.wrap(CW - 32, H)
    height = ph + 57
    c.setFillColor(bg)
    c.roundRect(M, y - height, CW, height, 10, fill=1, stroke=0)
    para(title, M + 16, y - 15, CW - 32, 11, 15, NAVY, True)
    para(body, M + 16, y - 36, CW - 32)
    return y - height - 15

def nav(labels, y):
    text = "  /  ".join(labels)
    return box("Your main pages", escape(text), y)

def link(label, url, y):
    return para(f'<link href="{url}" color="#146c99"><u>{label}</u></link>', M, y, CW, 11, 16) - 16

def finish(y):
    if y < 65:
        raise RuntimeError(f"Page {PAGE} content reaches the footer: {y:.1f}")

# 1 - quick start and a genuinely useful, scannable entry point.
y = page("Start here", "Your guide to defense day", "A short guide for PSITS students, teachers and the thesis coordinator.")
y = heading("Open the app", y)
y = link("psits-thesis-scheduler.vercel.app", URL + "/login", y)
qr = QrCodeWidget(URL + "/login")
b = qr.getBounds()
scale = 92 / (b[2] - b[0])
d = Drawing(92, 92, transform=[scale, 0, 0, scale, 0, 0])
d.add(qr)
renderPDF.draw(d, c, W - M - 96, y - 94)
y = para("Use your phone or computer. On a phone, tap <b>Menu</b> to see your pages. All dates and times use <b>Philippine Time (Asia/Manila)</b>.", M, y, CW - 125, 11, 16) - 55
y = heading("Go straight to your role", y)
for label, text, number in [
    ("Student", "Check your group, share your available times and see your defense.", 3),
    ("Teacher", "Share your times, review assigned groups and check your workload.", 4),
    ("Coordinator", "Set up accounts and records, then review and publish schedules.", 5),
]:
    y = box(f"{label}  |  Page {number}", text, y)
y = box("The basic flow", "<b>Available times</b> + <b>approved group</b> + <b>complete committee</b> + <b>available room</b> &rarr; coordinator creates a draft &rarr; coordinator publishes the schedule.", y)
y = para("First sign-in and authenticator: page 2  |  Reports and changes: page 7  |  Sign out and help: page 8", M, y, CW, 9, 13, MUTED)
finish(y)

# 2 - one clear enrollment journey; no shared credentials or secret QR content.
y = page("Everyone", "Sign in and secure your account", "Use your own account and your own authenticator app.")
y = step(1, "Get your account", "Your coordinator gives you your email login and a temporary password privately. There is no shared demo login or public student sign-up.", y)
y = step(2, "Choose your personal password", "Sign in. If asked, replace the temporary password with your own password of at least <b>12 characters</b>. Sign in again with the new password.", y)
y = step(3, "Connect an authenticator", "On <b>Set up your authenticator</b>, confirm your password and choose <b>Connect authenticator</b>. In your authenticator app, add an account and scan the QR code.", y)
y = step(4, "Verify the six-digit code", "Enter the current code from your authenticator, then choose <b>Verify authenticator</b>. If you cannot scan, open <b>Can't scan? Enter a setup key</b> and choose a time-based account in your authenticator.", y)
y = step(5, "Save the recovery codes", "Download or privately save the recovery codes. Each code works once if your phone is lost. Tick <b>I have saved my recovery codes</b>, then choose <b>Continue to home</b>.", y)
y = box("Every later sign-in", "Enter your email and password, then the current six-digit code. If needed, select <b>Use a recovery code</b>. Keep your password, authenticator setup key and recovery codes private.", y)
finish(y)

# 3 - students.
y = page("Students", "Your four everyday pages", "Start with your group and your available times.")
y = nav(["Home", "My group", "My availability", "My schedule"], y)
y = step(1, "Check My group", "Confirm your members, thesis title, adviser and panel. If the group is missing or a detail is wrong, contact the coordinator.", y)
y = step(2, "Add your available times", "Open <b>My availability</b> &gt; <b>Add time</b>. Choose <b>Available</b>, then <b>Every week</b> or <b>One date</b>. Tick the days, enter <b>From</b> and <b>Until</b>, then choose <b>Save times</b>.", y)
y = step(3, "Submit your group for review", "When ready, open <b>My group</b> and choose <b>Submit for review</b>. <b>Awaiting review</b> means your request has been sent. Your adviser or coordinator handles approval.", y)
y = step(4, "Check My schedule", "After the coordinator publishes, check the defense date, start time, room, building and directions. Until then, <b>No published defense yet</b> is normal.", y)
y = step(5, "Request a change when needed", "Use <b>Request change</b> on your schedule. Explain the group, existing schedule, requested change and reason. Submitting a request does not move the official schedule.", y)
y = box("Keep your times accurate", "Add <b>Unavailable</b> time for classes or other conflicts. A date-specific available range replaces your weekly availability for that date. Unavailable periods take priority. Every required participant needs submitted availability.", y)
finish(y)

# 4 - teachers.
y = page("Teachers", "Availability, groups and workload", "Your workspace focuses on your own assignments.")
y = nav(["Home", "My groups", "My availability", "My schedule", "My workload"], y)
y = step(1, "Share your available times", "Open <b>My availability</b> and use <b>Add time</b>. Save weekly days or a specific date. Add <b>Unavailable</b> periods for classes, meetings and other conflicts.", y)
y = step(2, "Review My groups", "Check your assigned groups, membership and committee role. An assigned panelist's role differs from the group's adviser.", y)
y = step(3, "Approve readiness when allowed", "If you are the group's adviser and college rules allow it, choose <b>Approve ready</b> after review. Otherwise, ask the coordinator to handle readiness. <b>Ready to schedule</b> is approval for scheduling, not a published appointment.", y)
y = step(4, "Check My workload", "Review your advising load and defense limits. Set your acceptance preference for new advisees. Use <b>Request capacity change</b> if a coordinator review is needed.", y)
y = step(5, "Follow the published schedule", "Open <b>My schedule</b> for dates and room details. Use <b>Download schedule</b> for reports or <b>Request change</b> if a conflict needs coordinator action.", y)
y = box("When your plans change", "Update your saved times promptly. A changed availability entry can flag a published defense for review; the existing reservation stays until the coordinator changes it.", y)
finish(y)

# 5 - real owner setup and account administration.
y = page("Coordinator / setup", "Prepare your real workspace", "Complete these once, then maintain them as people and terms change.")
y = step(1, "Create the first coordinator, if needed", "The app owner privately provides the setup key. Open <b>/setup</b>, enter the actual college and coordinator details, and choose a password. Sign in and connect your authenticator. This setup closes after the first account exists.", y)
y = step(2, "Set up the college", "In <b>College setup</b>, add programs, sections, the academic term and defense stages. Use <b>Edit college and dates</b> and <b>Defense requirements</b> to match the actual college requirements.", y)
y = step(3, "Create teacher and student accounts", "Open <b>Accounts</b> &gt; <b>Add account</b>. Choose the account type and enter the real name, email and temporary password. Students also need their student number. Choose <b>Create account</b>.", y)
y = step(4, "Give each person their details privately", "Each person replaces the temporary password and connects their own authenticator. The app does not automatically email login details. Use <b>Manage</b> to correct a record or issue a new temporary password.", y)
y = step(5, "Add rooms and available hours", "Open <b>More</b> &gt; <b>Rooms</b>, then <b>Add room</b>. Enter the building, directions and capacity. In <b>Availability</b>, choose <b>Room</b>, select the room and save its available hours.", y)
y = box("Account and capacity checks", "Use <b>More</b> &gt; <b>Teachers</b> to review advising capacity and defense limits. A password reset keeps the person's authenticator connected. Review account status in <b>Accounts</b> before expecting a person to use the workspace.", y)
finish(y)

# 6 - schedule lifecycle.
y = page("Coordinator / scheduling", "Create, review and publish", "Only published sessions become the schedule participants rely on.")
y = step(1, "Create the thesis group", "Open <b>Thesis groups</b> &gt; <b>New group</b>. Complete group details, choose <b>Next: members</b>, select the students and defense stage, then <b>Save</b>. <b>Back</b> keeps your entries.", y)
y = step(2, "Assign the committee", "Open <b>Manage group</b> &gt; <b>Assign faculty</b>. Select the adviser, panelists and chair required by your college rules. Check advising capacity before assigning another group.", y)
y = step(3, "Check readiness and available times", "Approve the group when ready. All required students, teachers and the room need compatible available times. An empty availability entry is not treated as free time.", y)
y = step(4, "Generate the draft", "On Home, choose <b>Generate schedule</b>; on Schedule, choose <b>Create schedule</b>. Choose the term, stage, dates and rooms. Optionally choose specific groups. Select <b>Generate proposed schedule</b>.", y)
y = step(5, "Review the proposal", "Check times, rooms, participants and workload. Use each draft's <b>Manage</b> menu to edit or lock it. Open <b>More</b> &gt; <b>Waiting list</b> for groups that could not be placed and their reasons.", y)
y = step(6, "Publish when ready", "Choose <b>Publish all draft sessions</b>. Publication checks the current records again and notifies participants in the app. Students and teachers can then see their published sessions.", y)
y = box("If a group remains unscheduled", "Check missing availability, incomplete committees, readiness, room capacity and workload limits. Request more available times or review dates and assignments. Regenerate and review the draft after correcting the issue.", y)
finish(y)

# 7 - reports and controlled changes.
y = page("Everyone / schedules", "Download, print and request changes", "Always check whether you are viewing a draft or a published schedule.")
y = step(1, "Open the correct report", "From <b>My schedule</b> or <b>Schedule</b>, choose <b>Download schedule</b>. The coordinator can also use <b>More</b> &gt; <b>Reports</b>. Students and teachers only see reports permitted for their role and participation.", y)
y = step(2, "Choose filters and preview", "Select the report type and any relevant date, program, section, faculty, room or stage filters. Choose <b>Preview student list</b> to check the roster before sharing.", y)
y = step(3, "Download and print", "Choose <b>Download PDF</b>. Open the downloaded file and use your PDF viewer's print function. A student CSV export is also available on the report page. Share only the report intended for its recipients.", y)
y = box("Draft PDF versus published report", "<b>Download DRAFT PDF</b> on the draft screen is a proposal for review. It does not publish a schedule. For the current official appointment details, use the published schedule and current report version.", y)
y = heading("Coordinator: change a published session", y)
y = para("Open <b>Schedule</b>, then the session's <b>Manage</b> menu. <b>Edit</b> opens rescheduling with the date, time, room and reason. The same conflict rules still apply. Use <b>Cancel</b> or <b>Complete</b> with the required reason or note when appropriate.", M, y) - 17
y = para("Use <b>History</b> to review published versions. Rescheduling preserves previous versions and informs affected participants. Review open requests in <b>Notifications</b> or <b>College setup</b>; resolving a request and changing the session are separate actions.", M, y) - 17
y = box("Check the final version", "After a change, review the new date, time and room, then download a fresh report. An older PDF remains a copy of an older schedule version.", y)
finish(y)

# 8 - the newly requested confirmation and practical recovery.
y = page("Everyone / help", "Sign out safely and get help", "Use your profile menu for account security and signing out.")
y = step(1, "Open Sign out", "In the workspace, click your name or avatar and choose <b>Sign out</b>. Sign out is also available while you are setting up your password or authenticator.", y)
y = step(2, "Choose Cancel or Sign out", "The app asks: <b>Are you sure you want to sign out?</b> Choose <b>Cancel</b> to stay signed in, or <b>Sign out</b> to confirm. Escape also cancels before the request is sent.", y)
dialog_image = ROOT / "docs/assets/sign-out-confirmation.png"
if dialog_image.exists():
    iw, ih = Image.open(dialog_image).size
    dw = min(CW, 420, 145 * iw / ih)
    dh = ih * dw / iw
    c.drawImage(str(dialog_image), M + (CW - dw)/2, y - dh, dw, dh, mask="auto")
    y -= dh + 16
else:
    y = box("After confirmation", "The app returns to <b>Sign in</b>. To return to the workspace, enter your password and your authenticator or recovery code.", y)
y = heading("Quick help", y)
for title, body in [
    ("No account, wrong details or forgotten password", "Contact the thesis coordinator. They manage accounts and temporary passwords."),
    ("Authenticator code is rejected", "Use the latest code for your PSITS account. Check your phone's automatic date and time. If asked to wait after repeated attempts, wait before trying again."),
    ("Phone is lost", "Choose Use a recovery code at sign-in. A saved recovery code works once. If none remain, contact the app owner; a password reset does not remove the authenticator."),
    ("No schedule or a connection error", "A schedule may not be published yet. Contact your coordinator if expected details are missing. For connection errors, check the connection and retry; read any on-screen error."),
]:
    y = para(title, M, y, CW, 10.5, 14, NAVY, True) - 3
    y = para(body, M, y, CW, 10, 14) - 13
finish(y)

c.save()
print(f"Created {OUT} ({PAGE} pages)")
