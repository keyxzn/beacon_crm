"""
Seed data awal buat beacon dulu biar begitu backend+frontend jalan,
datanya udah mirip sama mockup yang udah di-approve Daniel.

Cara pakai (dari folder backend/, venv udah aktif):
    python -m app.seed
"""

from datetime import datetime, timedelta, timezone

from app.database import Base, engine, SessionLocal
from app import models, ai_service
from app.security import hash_password


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(models.User).first():
        print("Data udah ada, seed dibatalin biar gak duplikat.")
        db.close()
        return

    now = datetime.now(timezone.utc)

    # ---------- users ----------
    daniel = models.User(name="Daniel", email="daniel@beacon.id",
                          password_hash=hash_password("daniel123"), role=models.RoleEnum.admin)
    nadia = models.User(name="Nadia Putri", email="nadia@beacon.id",
                         password_hash=hash_password("nadia123"), role=models.RoleEnum.manager)
    dimas = models.User(name="Dimas Pradana", email="dimas@beacon.id",
                         password_hash=hash_password("dimas123"), role=models.RoleEnum.sales)
    rizky = models.User(name="Rizky Pratama", email="rizky@beacon.id",
                         password_hash=hash_password("rizky123"), role=models.RoleEnum.sales)
    fajar = models.User(name="Fajar Nugroho", email="fajar@beacon.id",
                         password_hash=hash_password("fajar123"), role=models.RoleEnum.sales)
    db.add_all([daniel, nadia, dimas, rizky, fajar])
    db.commit()

    # ---------- leads yang udah approved (lead aktif normal) ----------
    def make_lead(name, company, role_title, email, phone, status, source, owner,
                  vendor_name=None, description=None, budget=None, timeline=None,
                  days_ago_activity=0):
        lead = models.Lead(
            name=name, company=company, role_title=role_title, email=email, phone=phone,
            status=status, source=source, owner_id=owner.id,
            vendor_name=vendor_name, description=description, budget=budget, timeline=timeline,
            approval_status=models.ApprovalStatusEnum.approved,
            submitted_at=now - timedelta(days=days_ago_activity + 1),
            reviewed_at=now - timedelta(days=days_ago_activity + 1),
            last_activity_at=now - timedelta(days=days_ago_activity),
        )
        db.add(lead)
        db.flush()
        return lead

    budi = make_lead("Budi Santoso", "PT Nusantara Digital", "Head of Ops",
                      "budi@nusantara-digital.id", "+62 812-3456-7890",
                      models.LeadStatusEnum.new, "Website", dimas,
                      vendor_name="PT Nusantara Digital", description="Implementasi sistem CRM internal buat tim sales mereka.",
                      budget=90_000_000, timeline="Q3 2026", days_ago_activity=0)
    siti = make_lead("Siti Rahma", "CV Berkah Jaya", "Manager",
                      "siti@berkahjaya.id", "+62 813-1111-2222",
                      models.LeadStatusEnum.contacted, "Referral", nadia,
                      vendor_name="CV Berkah Jaya", description="Paket tahunan buat distribusi produk consumer goods.",
                      budget=47_000_000, timeline="2 bulan", days_ago_activity=1)
    andi = make_lead("Andi Wijaya", "Andi Wijaya Group", "CEO",
                      "andi@awgroup.id", "+62 813-2222-3333",
                      models.LeadStatusEnum.qualified, "Event", dimas,
                      vendor_name="Andi Wijaya Group", description="Kontrak korporat skala grup, multi-cabang.",
                      budget=120_000_000, timeline="Q4 2026", days_ago_activity=1)
    putri = make_lead("Putri Lestari", "Sumber Rejeki Tani", "Owner",
                       "putri@sumberrejeki.id", "+62 813-3333-4444",
                       models.LeadStatusEnum.unqualified, "Cold outreach", nadia,
                       vendor_name="Sumber Rejeki Tani", description="Awalnya nanya-nanya soal harga, gak lanjut.",
                       budget=15_000_000, timeline="-", days_ago_activity=5)
    rina = make_lead("Rina Wulandari", "Maju Bersama Tbk", "Finance",
                      "rina@majubersama.id", "+62 813-4444-5555",
                      models.LeadStatusEnum.new, "Website", dimas,
                      vendor_name="Maju Bersama Tbk", description="Pilot project buat divisi finance sebelum scale up.",
                      budget=65_000_000, timeline="6 minggu", days_ago_activity=2)

    # customers (closed-won) buat demo churn risk
    sejahtera = make_lead("Eka Wijaya", "PT Sejahtera Makmur", "Procurement",
                           "eka@sejahteramakmur.id", "+62 813-5555-6666",
                           models.LeadStatusEnum.qualified, "Referral", rizky,
                           vendor_name="PT Sejahtera Makmur", description="Kontrak tahunan, udah closed won.",
                           budget=98_000_000, timeline="1 tahun", days_ago_activity=22)
    abadi = make_lead("Joko Susanto", "CV Abadi Sentosa", "Owner",
                       "joko@abadisentosa.id", "+62 813-6666-7777",
                       models.LeadStatusEnum.qualified, "Event", fajar,
                       vendor_name="CV Abadi Sentosa", description="Kontrak tahunan, udah closed won.",
                       budget=56_000_000, timeline="1 tahun", days_ago_activity=25)
    surya = make_lead("Bagas Pratama", "Surya Abadi Tech", "CTO",
                       "bagas@suryaabadi.id", "+62 813-7777-8888",
                       models.LeadStatusEnum.qualified, "Referral", rizky,
                       vendor_name="Surya Abadi Tech", description="Kontrak tahunan, udah closed won.",
                       budget=142_000_000, timeline="1 tahun", days_ago_activity=3)

    db.commit()

    # ---------- contoh lead yang lagi di approval workflow (demo fitur baru) ----------
    pending_review = models.Lead(
        name="Hendra Saputra", company="PT Cakra Mandiri", role_title="Purchasing Manager",
        email="hendra@cakramandiri.id", phone="+62 812-9999-1111",
        status=models.LeadStatusEnum.new, source="Cold outreach", owner_id=rizky.id,
        vendor_name="PT Cakra Mandiri", description="Mau implementasi sistem buat tim purchasing, masih awal banget diskusinya.",
        budget=40_000_000, timeline="Q1 2027",
        approval_status=models.ApprovalStatusEnum.in_review,
        submitted_at=now - timedelta(hours=4),
        last_activity_at=now - timedelta(hours=4),
    )
    draft_lead = models.Lead(
        name="Lina Marlina", company="Toko Sinar Abadi", role_title="Owner",
        email="lina@sinarabadi.id", phone="+62 812-8888-2222",
        status=models.LeadStatusEnum.new, source="Website", owner_id=fajar.id,
        vendor_name="Toko Sinar Abadi", description="",
        budget=None, timeline=None,
        approval_status=models.ApprovalStatusEnum.draft,
        last_activity_at=now - timedelta(hours=1),
    )
    rejected_lead = models.Lead(
        name="Yoga Saputro", company="Warung Kita Group", role_title="Procurement",
        email="yoga@warungkita.id", phone="+62 812-7777-3333",
        status=models.LeadStatusEnum.new, source="Cold outreach", owner_id=rizky.id,
        vendor_name="Warung Kita Group", description="Cuma nanya-nanya harga, pas mau prepare proposal ngilang.",
        budget=20_000_000, timeline="2 bulan",
        approval_status=models.ApprovalStatusEnum.rejected,
        submitted_at=now - timedelta(days=2),
        reviewed_at=now - timedelta(days=1),
        reviewed_by=nadia.id,
        review_note="Sinyal lead bodong itu gak ada follow-up balik 2 minggu, kemungkinan cuma survey harga.",
        last_activity_at=now - timedelta(days=1),
    )
    db.add_all([pending_review, draft_lead, rejected_lead])
    db.commit()

    # ---------- interactions ----------
    db.add_all([
        models.Interaction(lead_id=budi.id, created_by=dimas.id, type=models.InteractionTypeEnum.call,
                            note="Menelepon, bahas kebutuhan & budget. Aktif diskusi soal harga.",
                            created_at=now - timedelta(minutes=10)),
        models.Interaction(lead_id=budi.id, created_by=dimas.id, type=models.InteractionTypeEnum.meeting,
                            note="Meeting di-reschedule ke minggu depan (2x reschedule).",
                            created_at=now - timedelta(days=1)),
        models.Interaction(lead_id=budi.id, created_by=dimas.id, type=models.InteractionTypeEnum.email,
                            note="Mengirim brosur produk & price list.",
                            created_at=now - timedelta(days=3)),
        models.Interaction(lead_id=siti.id, created_by=nadia.id, type=models.InteractionTypeEnum.email,
                            note="Mengirim proposal awal ke CV Berkah Jaya.",
                            created_at=now - timedelta(hours=1)),
        # Andi Wijaya udah di stage Proposal dan itu wajib ada jejak komunikasi sebelumnya
        models.Interaction(lead_id=andi.id, created_by=dimas.id, type=models.InteractionTypeEnum.call,
                            note="Kontak pertama via telepon, Andi tertarik & minta dikirim proposal lengkap.",
                            created_at=now - timedelta(days=9)),
        models.Interaction(lead_id=andi.id, created_by=dimas.id, type=models.InteractionTypeEnum.meeting,
                            note="Meeting presentasi produk di kantor Andi Wijaya Group, dihadiri tim procurement.",
                            created_at=now - timedelta(days=6)),
        models.Interaction(lead_id=andi.id, created_by=dimas.id, type=models.InteractionTypeEnum.email,
                            note="Mengirim dokumen proposal kontrak korporat dan nunggu review internal mereka.",
                            created_at=now - timedelta(days=2)),
        models.Interaction(lead_id=andi.id, created_by=dimas.id, type=models.InteractionTypeEnum.note,
                            note="Andi minta waktu sampai akhir bulan buat keputusan internal, budget udah disetujui direksi.",
                            created_at=now - timedelta(hours=4)),
        # ---- lead lain yang sebelumnya gak punya interaksi sama sekali ----
        models.Interaction(lead_id=rina.id, created_by=dimas.id, type=models.InteractionTypeEnum.email,
                            note="Mengirim info awal soal pilot project ke Rina, nunggu balasan.",
                            created_at=now - timedelta(days=2)),
        models.Interaction(lead_id=putri.id, created_by=nadia.id, type=models.InteractionTypeEnum.call,
                            note="Nelepon buat follow-up, Putri bilang masih riset harga kompetitor.",
                            created_at=now - timedelta(days=5)),
        models.Interaction(lead_id=sejahtera.id, created_by=rizky.id, type=models.InteractionTypeEnum.meeting,
                            note="Meeting review tahunan, PT Sejahtera Makmur puas sama implementasi.",
                            created_at=now - timedelta(days=22)),
        models.Interaction(lead_id=sejahtera.id, created_by=rizky.id, type=models.InteractionTypeEnum.note,
                            note="Kontrak diperpanjang otomatis buat tahun depan.",
                            created_at=now - timedelta(days=20)),
        models.Interaction(lead_id=abadi.id, created_by=fajar.id, type=models.InteractionTypeEnum.email,
                            note="Mengirim laporan pemakaian Q2 ke CV Abadi Sentosa.",
                            created_at=now - timedelta(days=25)),
        models.Interaction(lead_id=surya.id, created_by=rizky.id, type=models.InteractionTypeEnum.call,
                            note="Diskusi penambahan seat buat tim engineering Surya Abadi Tech.",
                            created_at=now - timedelta(days=3)),
    ])
    db.commit()

    # ---------- deals (pipeline) ----------
    def make_deal(lead, title, value, stage, owner, days_ago_update=0):
        deal = models.Deal(
            lead_id=lead.id, title=title, value=value, stage=stage, owner_id=owner.id,
            updated_at=now - timedelta(days=days_ago_update),
        )
        db.add(deal)
        return deal

    make_deal(budi, "PT Nusantara Digital : implementasi awal", 89_000_000, models.DealStageEnum.kualifikasi, dimas)
    deal_siti = make_deal(siti, "CV Berkah Jaya : paket tahunan", 47_000_000, models.DealStageEnum.kualifikasi, nadia)
    deal_andi = make_deal(andi, "Andi Wijaya Group : kontrak korporat", 120_000_000, models.DealStageEnum.proposal, dimas)
    make_deal(rina, "Maju Bersama Tbk : pilot project", 65_000_000, models.DealStageEnum.baru, dimas)

    # closed won buat leaderboard & reports
    deal_surya = make_deal(surya, "Surya Abadi Tech : kontrak tahunan", 142_000_000, models.DealStageEnum.closed_won, rizky, days_ago_update=10)
    deal_sejahtera = make_deal(sejahtera, "PT Sejahtera Makmur : kontrak tahunan", 98_000_000, models.DealStageEnum.closed_won, rizky, days_ago_update=70)
    deal_abadi = make_deal(abadi, "CV Abadi Sentosa : kontrak tahunan", 56_000_000, models.DealStageEnum.closed_won, fajar, days_ago_update=80)

    db.commit()

    # ---------- deal documents (output per stage, bukan cuma proposal) ----------
    db.add_all([
        # kualifikasi -> catatan kebutuhan
        models.DealDocument(
            deal_id=deal_siti.id, stage=models.DealStageEnum.kualifikasi,
            doc_type=models.DealDocTypeEnum.qualification_notes, label="Catatan kebutuhan",
            url="https://drive.google.com/file/d/contoh-catatan-kebutuhan-berkah-jaya",
            note="Hasil diskusi awal: butuh paket distribusi buat 3 gudang, mulai Q3.",
            created_by=nadia.id, created_at=now - timedelta(hours=1),
        ),
        # proposal -> dokumen proposal (Andi Wijaya)
        models.DealDocument(
            deal_id=deal_andi.id, stage=models.DealStageEnum.proposal,
            doc_type=models.DealDocTypeEnum.proposal, label="Dokumen Proposal",
            url="https://drive.google.com/file/d/contoh-proposal-andi-wijaya-group",
            note="Proposal kontrak korporat 1 tahun, termasuk implementasi + training tim. Revisi terakhir sesuai request budget direksi.",
            created_by=dimas.id, created_at=now - timedelta(days=2),
        ),
        # closed_won -> kontrak final buat masing-masing customer
        models.DealDocument(
            deal_id=deal_surya.id, stage=models.DealStageEnum.closed_won,
            doc_type=models.DealDocTypeEnum.contract, label="Kontrak Final",
            url="https://drive.google.com/file/d/contoh-kontrak-surya-abadi-tech",
            note="Kontrak tahunan udah ditandatangani kedua pihak.",
            created_by=rizky.id, created_at=now - timedelta(days=10),
        ),
        models.DealDocument(
            deal_id=deal_sejahtera.id, stage=models.DealStageEnum.closed_won,
            doc_type=models.DealDocTypeEnum.contract, label="Kontrak Final",
            url="https://drive.google.com/file/d/contoh-kontrak-sejahtera-makmur",
            note="Kontrak tahunan, otomatis diperpanjang tahun depan.",
            created_by=rizky.id, created_at=now - timedelta(days=70),
        ),
        models.DealDocument(
            deal_id=deal_abadi.id, stage=models.DealStageEnum.closed_won,
            doc_type=models.DealDocTypeEnum.contract, label="Kontrak Final",
            url="https://drive.google.com/file/d/contoh-kontrak-abadi-sentosa",
            note="Kontrak tahunan udah aktif jalan.",
            created_by=fajar.id, created_at=now - timedelta(days=80),
        ),
    ])

    db.commit()

    # ---------- activities ----------
    db.add_all([
        models.Activity(lead_id=rina.id, owner_id=dimas.id, type=models.ActivityTypeEnum.call,
                         title="Follow-up ke PT Maju Bersama", due_at=now - timedelta(hours=2),
                         completed_at=now - timedelta(hours=1)),
        models.Activity(lead_id=siti.id, owner_id=nadia.id, type=models.ActivityTypeEnum.email,
                         title="Kirim ulang proposal ke CV Berkah Jaya", due_at=now + timedelta(hours=2)),
        models.Activity(lead_id=andi.id, owner_id=dimas.id, type=models.ActivityTypeEnum.meeting,
                         title="Diskusi kontrak dengan Andi Wijaya Group", due_at=now + timedelta(days=1)),
        models.Activity(lead_id=surya.id, owner_id=rizky.id, type=models.ActivityTypeEnum.internal,
                         title="Cek invoice dari Surya Abadi Tech", due_at=now - timedelta(days=2)),
    ])
    db.commit()

    # ---------- hitung AI score & probability awal ----------
    for lead in [budi, siti, andi, putri, rina, sejahtera, abadi, surya, pending_review, rejected_lead]:
        interactions = [{"type": i.type.value, "note": i.note} for i in lead.interactions]
        result = ai_service.score_lead(
            {"status": lead.status.value, "source": lead.source, "company": lead.company}, interactions
        )
        lead.ai_score = result["score"]
        lead.ai_score_reason = result["reason"]
    db.commit()

    for deal in db.query(models.Deal).all():
        lead = deal.lead
        result = ai_service.predict_win_probability(
            {"stage": deal.stage.value, "value": float(deal.value)},
            {"status": lead.status.value, "ai_score": lead.ai_score},
        )
        deal.ai_probability = result["probability"]
    db.commit()

    db.close()
    print("Seed selesai : 5 user, 11 lead (8 approved, 1 in_review, 1 draft, 1 rejected), 7 deal, 4 aktivitas berhasil dibuat.")
    print("Login demo: dimas@beacon.id / dimas123 (sales), nadia@beacon.id (manager), daniel@beacon.id (admin)")


if __name__ == "__main__":
    run()