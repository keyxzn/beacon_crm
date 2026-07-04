import io
from datetime import datetime, timezone, timedelta, date
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, ai_service
from app.deps import get_current_user

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors as rl_colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_RIGHT

router = APIRouter(prefix="/reports", tags=["reports"])

MONTH_LABELS = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]


def _resolve_range(from_date: str | None, to_date: str | None, granularity: str):
    """Default range: 14 hari terakhir buat harian, 6 bulan terakhir buat bulanan."""
    today = datetime.now(timezone.utc).date()
    if to_date:
        end = datetime.strptime(to_date, "%Y-%m-%d").date()
    else:
        end = today
    if from_date:
        start = datetime.strptime(from_date, "%Y-%m-%d").date()
    elif granularity == "daily":
        start = end - timedelta(days=13)
    else:
        start = (end.replace(day=1) - timedelta(days=150)).replace(day=1)
    return start, end


@router.get("", response_model=schemas.ReportsOut)
def get_reports(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    granularity: str = Query("monthly", pattern="^(daily|monthly)$"),
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
):
    is_sales = current_user.role == models.RoleEnum.sales
    start, end = _resolve_range(from_date, to_date, granularity)
    range_start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
    range_end_dt = datetime.combine(end, datetime.max.time(), tzinfo=timezone.utc)

    # ---- revenue per periode (deal closed_won), difilter sesuai rentang tanggal ----
    revenue_q = db.query(models.Deal).filter(
        models.Deal.stage == models.DealStageEnum.closed_won,
        models.Deal.updated_at >= range_start_dt,
        models.Deal.updated_at <= range_end_dt,
    )
    if is_sales:
        revenue_q = revenue_q.filter(models.Deal.owner_id == current_user.id)
    won_in_range = revenue_q.all()

    buckets: dict = defaultdict(float)
    if granularity == "daily":
        cursor = start
        while cursor <= end:
            buckets[cursor.isoformat()] = 0.0
            cursor += timedelta(days=1)
        for d in won_in_range:
            key = d.updated_at.date().isoformat()
            if key in buckets:
                buckets[key] += float(d.value or 0)
        revenue_by_month = [
            schemas.RevenueByMonth(month=f"{datetime.strptime(k, '%Y-%m-%d').day} {MONTH_LABELS[datetime.strptime(k, '%Y-%m-%d').month]}", total=v)
            for k, v in sorted(buckets.items())
        ]
    else:
        cursor = start.replace(day=1)
        while cursor <= end:
            buckets[f"{cursor.year}-{cursor.month:02d}"] = 0.0
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)
        for d in won_in_range:
            key = f"{d.updated_at.year}-{d.updated_at.month:02d}"
            if key in buckets:
                buckets[key] += float(d.value or 0)
        revenue_by_month = [
            schemas.RevenueByMonth(month=MONTH_LABELS[int(k.split("-")[1])], total=v)
            for k, v in sorted(buckets.items())
        ]

    # ---- funnel per stage (deal aktif di rentang yang dipilih, berdasarkan updated_at) ----
    funnel_order = ["baru", "kualifikasi", "proposal", "negosiasi", "closed_won"]
    funnel_q = db.query(models.Deal.stage, func.count(models.Deal.id)).filter(
        models.Deal.updated_at >= range_start_dt, models.Deal.updated_at <= range_end_dt,
    )
    if is_sales:
        funnel_q = funnel_q.filter(models.Deal.owner_id == current_user.id)
    raw_counts = funnel_q.group_by(models.Deal.stage).all()
    counts = {stage.value: total for stage, total in raw_counts}
    funnel = [schemas.FunnelStage(stage=s, count=counts.get(s, 0)) for s in funnel_order]

    # ---- leaderboard ----
    # Sales cuma boleh liat baris dia sendiri. Manager/admin liat semua sales
    # (bukan sesama manager/admin — leaderboard ini soal ranking tim sales).
    if is_sales:
        users = [current_user]
    else:
        users = db.query(models.User).filter(models.User.role == models.RoleEnum.sales).all()
    leaderboard = []
    for user in users:
        all_deals = db.query(models.Deal).filter(models.Deal.owner_id == user.id).all()
        if not all_deals:
            continue
        won = [d for d in all_deals if d.stage == models.DealStageEnum.closed_won]
        decided = [d for d in all_deals if d.stage in (models.DealStageEnum.closed_won, models.DealStageEnum.closed_lost)]
        win_rate = (len(won) / len(decided) * 100) if decided else 0
        leaderboard.append(schemas.LeaderboardRow(
            user_id=user.id, name=user.name,
            deals_closed=len(won), win_rate=round(win_rate, 1),
            revenue=float(sum(float(d.value or 0) for d in won)),
        ))
    leaderboard.sort(key=lambda r: r.revenue, reverse=True)

    # ---- churn risk (AI) — sales cuma liat customer dia sendiri ----
    won_deals_q = db.query(models.Deal).filter(models.Deal.stage == models.DealStageEnum.closed_won)
    if is_sales:
        won_deals_q = won_deals_q.filter(models.Deal.owner_id == current_user.id)
    won_lead_ids = {d.lead_id for d in won_deals_q.all()}

    customers_payload = []
    now = datetime.now(timezone.utc)
    for lead_id in won_lead_ids:
        lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
        if not lead:
            continue
        last_activity = lead.last_activity_at
        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)
        days = (now - last_activity).days
        customers_payload.append({
            "lead_id": lead.id, "company": lead.company, "days_since_last_activity": days,
        })

    churn_raw = ai_service.predict_churn_risks(customers_payload)
    churn_risk = [
        schemas.ChurnRiskRow(
            lead_id=c["lead_id"], company=c["company"],
            reason=c["reason"], recommendation=c["recommendation"],
        ) for c in churn_raw
    ]

    # ---- detail deal — daftar per-deal di rentang tanggal yang dipilih, buat tabel detail di halaman Reports ----
    deals_q = db.query(models.Deal).filter(
        models.Deal.updated_at >= range_start_dt, models.Deal.updated_at <= range_end_dt,
    )
    if is_sales:
        deals_q = deals_q.filter(models.Deal.owner_id == current_user.id)
    deal_rows = deals_q.order_by(models.Deal.updated_at.desc()).all()
    deals = [
        schemas.DealDetailRow(
            id=d.id, lead_id=d.lead_id, title=d.title,
            company=d.lead.company if d.lead else "—",
            stage=d.stage.value if hasattr(d.stage, "value") else d.stage,
            value=float(d.value or 0),
            owner_name=d.owner.name if d.owner else None,
            updated_at=d.updated_at.isoformat(),
        ) for d in deal_rows
    ]

    return schemas.ReportsOut(
        granularity=granularity,
        range_from=start.isoformat(),
        range_to=end.isoformat(),
        revenue_by_month=revenue_by_month,
        funnel=funnel,
        leaderboard=leaderboard,
        churn_risk=churn_risk,
        deals=deals,
    )


STAGE_LABELS = {
    "baru": "Baru",
    "kualifikasi": "Kualifikasi",
    "proposal": "Proposal",
    "negosiasi": "Negosiasi",
    "closed_won": "Closed Won",
    "closed_lost": "Closed Lost",
}
STAGE_ORDER = ["baru", "kualifikasi", "proposal", "negosiasi", "closed_won", "closed_lost"]

# Palet warna khusus buat PDF — sengaja terang/print-friendly (bukan tema gelap
# di web), biar enak dibaca kalau dicetak atau dibuka di viewer apapun.
_NAVY = rl_colors.HexColor("#0F1B2E")
_TEAL = rl_colors.HexColor("#0E7C86")
_MUTED = rl_colors.HexColor("#6B7688")
_BORDER = rl_colors.HexColor("#E2E6EC")
_GREEN = rl_colors.HexColor("#1A9C5C")
_ROW_ALT = rl_colors.HexColor("#F7F9FB")


def _fmt_rupiah(n: float) -> str:
    return f"Rp {int(round(n)):,}".replace(",", ".")


def _fmt_tanggal(dt: datetime, with_time: bool = True) -> str:
    s = f"{dt.day:02d} {MONTH_LABELS[dt.month]} {dt.year}"
    return f"{s}, {dt.strftime('%H:%M')}" if with_time else s


@router.get("/export")
def export_reports_pdf(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
):
    """Export laporan (ringkasan + sebaran stage + detail deal) jadi PDF rapi,
    biar bisa langsung dibagikan/diprint buat Mas Firman dkk."""
    is_sales = current_user.role == models.RoleEnum.sales
    start, end = _resolve_range(from_date, to_date, "monthly")
    range_start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
    range_end_dt = datetime.combine(end, datetime.max.time(), tzinfo=timezone.utc)

    q = db.query(models.Deal).filter(
        models.Deal.updated_at >= range_start_dt, models.Deal.updated_at <= range_end_dt,
    )
    if is_sales:
        q = q.filter(models.Deal.owner_id == current_user.id)
    deals = q.order_by(models.Deal.updated_at.desc()).all()

    won = [d for d in deals if d.stage == models.DealStageEnum.closed_won]
    lost = [d for d in deals if d.stage == models.DealStageEnum.closed_lost]
    decided = len(won) + len(lost)
    total_revenue = sum(float(d.value or 0) for d in won)
    win_rate = round(len(won) / decided * 100, 1) if decided else 0
    avg_deal = total_revenue / len(won) if won else 0

    per_stage: dict = defaultdict(int)
    for d in deals:
        key = d.stage.value if hasattr(d.stage, "value") else d.stage
        per_stage[key] += 1
    total_deals = len(deals) or 1

    # ---------- build PDF ----------
    styles = getSampleStyleSheet()
    brand_style = ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=13, textColor=_TEAL)
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, textColor=_NAVY, spaceAfter=2)
    sub_style = ParagraphStyle("sub", fontName="Helvetica", fontSize=9.5, textColor=_MUTED)
    section_title = ParagraphStyle("sectionTitle", fontName="Helvetica-Bold", fontSize=12.5, textColor=_NAVY, spaceBefore=16, spaceAfter=8)
    kpi_label = ParagraphStyle("kpiLabel", fontName="Helvetica", fontSize=8, textColor=_MUTED)
    kpi_val = ParagraphStyle("kpiVal", fontName="Helvetica-Bold", fontSize=15, textColor=_NAVY)
    cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, textColor=_NAVY)
    cell_r = ParagraphStyle("cellR", fontName="Helvetica", fontSize=8.5, textColor=_NAVY, alignment=TA_RIGHT)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
        title="Laporan Beacon CRM",
    )
    story = []

    story.append(Paragraph("beacon", brand_style))
    story.append(Paragraph("Laporan Penjualan", h1))
    scope_note = " (data kamu sendiri)" if is_sales else ""
    story.append(Paragraph(
        f"Periode: {_fmt_tanggal(range_start_dt, False)} &ndash; {_fmt_tanggal(range_end_dt, False)}"
        f"{scope_note} &nbsp;&bull;&nbsp; Diekspor {_fmt_tanggal(datetime.now(timezone.utc))}",
        sub_style,
    ))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.3, color=_TEAL))
    story.append(Spacer(1, 16))

    # KPI row
    kpis = [
        ("TOTAL REVENUE (WON)", _fmt_rupiah(total_revenue), _GREEN),
        ("TOTAL DEAL", str(len(deals)), _NAVY),
        ("WIN RATE", f"{win_rate}%", _NAVY),
        ("RATA-RATA DEAL (WON)", _fmt_rupiah(avg_deal) if won else "—", _NAVY),
    ]
    kpi_row = [[Paragraph(l, kpi_label), Paragraph(f'<font color="{c.hexval()}">{v}</font>', kpi_val)] for l, v, c in kpis]
    kpi_table = Table([kpi_row], colWidths=[(A4[0] - 36 * mm) / 4] * 4)
    kpi_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 2, _TEAL),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(kpi_table)

    # Sebaran per stage
    story.append(Paragraph("Sebaran per Stage", section_title))
    stage_rows = [["Stage", "Jumlah Deal", "% dari Total"]]
    for key in STAGE_ORDER:
        if per_stage.get(key):
            stage_rows.append([STAGE_LABELS[key], str(per_stage[key]), f"{round(per_stage[key] / total_deals * 100)}%"])
    if len(stage_rows) == 1:
        stage_rows.append(["Belum ada deal di periode ini", "-", "-"])
    t_stage = Table(stage_rows, colWidths=[80 * mm, 40 * mm, 40 * mm])
    t_stage.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, _ROW_ALT]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, _BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t_stage)

    # Detail deal
    story.append(Paragraph("Detail Deal", section_title))
    if deals:
        detail_rows = [["Deal", "Perusahaan", "Stage", "Nilai", "Sales", "Update"]]
        for d in deals:
            lead = d.lead
            owner = d.owner
            stage_key = d.stage.value if hasattr(d.stage, "value") else d.stage
            detail_rows.append([
                Paragraph(d.title, cell),
                Paragraph(lead.company if lead else "—", cell),
                Paragraph(STAGE_LABELS.get(stage_key, stage_key), cell),
                Paragraph(_fmt_rupiah(float(d.value or 0)), cell_r),
                Paragraph(owner.name if owner else "—", cell),
                Paragraph(_fmt_tanggal(d.updated_at, False), cell),
            ])
        t_detail = Table(detail_rows, colWidths=[38 * mm, 32 * mm, 24 * mm, 30 * mm, 32 * mm, 24 * mm], repeatRows=1)
        t_detail.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), _TEAL),
            ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, _ROW_ALT]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, _BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t_detail)
    else:
        story.append(Paragraph("Belum ada deal yang di-update di periode ini.", sub_style))

    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(_MUTED)
        canvas.drawString(18 * mm, 12 * mm, "beacon CRM — Laporan dibuat otomatis")
        canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Halaman {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)

    filename = f"beacon-report-{start.isoformat()}_{end.isoformat()}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )