"""
Progeni Atlas — Interview Invitation Documents
=============================================
Generates the branded PDF attached to interview invitation emails:
a proper Job Description document carrying the role, company, schedule,
and the candidate's preparation checklist.

Built with reportlab (already a backend dependency in production images).
"""

from __future__ import annotations

import io
import re
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#0f172a")
SLATE = colors.HexColor("#475569")
CYAN = colors.HexColor("#0891b2")
INK = colors.HexColor("#0f172a")
LINE = colors.HexColor("#e2e8f0")


def _sanitize_filename(role: str) -> str:
    base = re.sub(r"[^A-Za-z0-9 _-]+", "", str(role or "Role")).strip().replace(" ", "-")
    base = re.sub(r"-+", "-", base).strip("-") or "Interview"
    return f"Progeni-Atlas-{base}-JD.pdf"


def build_jd_pdf(
    *,
    company: str,
    role: str,
    jd_text: str,
    interview_date: str = "",
    interview_time: str = "",
    duration_minutes: int = 30,
    invite_url: str = "",
    recruiter_name: str = "",
    generated_by: str = "Progeni Atlas",
) -> tuple[bytes, str]:
    """Return (pdf_bytes, filename)."""
    buf = io.BytesIO()

    def draw_chrome(canvas, doc):
        canvas.saveState()
        # Header band
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 26 * mm, A4[0], 26 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 15)
        canvas.drawString(18 * mm, A4[1] - 14 * mm, "Progeni Atlas")
        canvas.setFillColor(CYAN)
        canvas.setFont("Helvetica", 8.5)
        canvas.drawString(18 * mm, A4[1] - 20 * mm, "INTERVIEW INVITATION  -  CONFIDENTIAL")
        canvas.setFillColor(CYAN)
        canvas.rect(0, A4[1] - 26 * mm - 1.2 * mm, A4[0], 1.2 * mm, fill=1, stroke=0)
        # Footer
        canvas.setFillColor(SLATE)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(18 * mm, 12 * mm, f"{company}  -  {role}  -  Issued by {generated_by}")
        canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Page {doc.page}")
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, 16 * mm, A4[0] - 18 * mm, 16 * mm)
        canvas.restoreState()

    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=34 * mm,
        bottomMargin=22 * mm,
        title=f"{role} — Interview Invitation — {company}",
        author=generated_by,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=draw_chrome)])

    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=19, leading=24, textColor=INK, spaceAfter=2 * mm)
    sub_style = ParagraphStyle("sub", fontName="Helvetica", fontSize=10, leading=13, textColor=SLATE, spaceAfter=6 * mm)
    h_style = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=NAVY, spaceBefore=4 * mm, spaceAfter=2 * mm)
    body_style = ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=2 * mm)
    small_style = ParagraphStyle("small", fontName="Helvetica", fontSize=8.5, leading=12, textColor=SLATE, spaceBefore=2 * mm)

    story = [
        Paragraph(f"Interview Invitation — {role}", title_style),
        Paragraph(f"{company}  -  via {generated_by}", sub_style),
    ]

    # Meta table
    schedule = "To be decided with the recruiter"
    if interview_date:
        try:
            d = datetime.strptime(interview_date.strip(), "%Y-%m-%d")
            schedule = d.strftime("%A, %d %B %Y")
            if interview_time:
                hh, minute_s = interview_time.strip().split(":")[:2]
                hour = int(hh)
                minute = minute_s[:2]
                suffix = "AM" if hour < 12 else "PM"
                display = hour % 12 or 12
                schedule += f"  at  {display}:{minute} {suffix}"
        except Exception:
            schedule = f"{interview_date}{(' at ' + interview_time) if interview_time else ''}"

    meta_rows = [
        ("Position", role),
        ("Company / Organisation", company),
        ("Scheduled", schedule),
        ("Duration", f"{duration_minutes} minutes"),
        ("Format", "Live AI Technical Interview (two-way voice + coding editor)"),
        ("Organizer", recruiter_name or "Company Recruiting Team"),
    ]
    meta_table = Table(meta_rows, colWidths=[52 * mm, 110 * mm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("TEXTCOLOR", (0, 0), (0, -1), SLATE),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [meta_table, Spacer(1, 4 * mm)]

    story += [Paragraph("About the role", h_style)]
    jd_clean = (jd_text or "Role details shared directly with your application.").strip()
    # Escape XML-sensitive chars for reportlab Paragraph
    esc = lambda s: (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    paragraphs = [p.strip() for p in re.split(r"\n{2,}|\r\n{2,}", jd_clean) if p.strip()]
    if len(paragraphs) == 1 and "\n" in jd_clean:
        paragraphs = [p.strip() for p in jd_clean.splitlines() if p.strip()]
    for p in paragraphs:
        # single newlines inside a para -> <br/>
        story.append(Paragraph(esc(p).replace("\n", "<br/>"), body_style))

    story += [Paragraph("Preparation checklist", h_style)]
    checklist = [
        "Keep your résumé handy — the interviewer AI references your experience.",
        "Join from a quiet room with a stable internet connection.",
        "Use a laptop or desktop with working camera and microphone (verified in the lobby).",
        "Practice the STAR method (Situation, Task, Action, Result) for behavioural rounds.",
        "Prepare at least two strong projects you can walk through end-to-end.",
        "Review fundamentals for the role: data structures, system design, and trade-offs.",
    ]
    for item in checklist:
        story.append(Paragraph(f"•  {esc(item)}", body_style))

    story += [Paragraph("How the interview works", h_style)]
    story.append(Paragraph(
        "This is a live, two-way technical interview conducted by Progeni Atlas's AI interviewer. "
        "Expect adaptive follow-up questions driven by your answers, an in-browser code editor for hands-on problems, "
        "and real-time rubric scoring. Your session is recorded and evaluated for fairness.",
        body_style,
    ))

    if invite_url:
        story += [Paragraph("Your interview link", h_style)]
        story.append(Paragraph(
            f'<link href="{esc(invite_url)}" color="#0891b2"><u>{esc(invite_url)}</u></link>',
            body_style,
        ))
        story.append(Paragraph("The link is personal to you. Do not forward it.", small_style))

    story += [Spacer(1, 4 * mm), Paragraph("This document is confidential to the named recipient. Any unauthorised distribution is prohibited.", small_style)]

    doc.build(story)
    return buf.getvalue(), _sanitize_filename(role)
