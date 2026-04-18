"""VC Scout - FastAPI Backend.

API for managing sources, topics, scanning for companies, and exporting data.
"""

import io
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from openpyxl import Workbook

from database import init_db, get_db, Source, Topic, Company, ScanLog, company_topics
from scraper import scrape_source, ScrapedCompany

# Initialize
app = FastAPI(title="VC Scout", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


# ──────────────────────── Pydantic Schemas ────────────────────────

class SourceCreate(BaseModel):
    name: str
    url: str

class SourceOut(BaseModel):
    id: int
    name: str
    url: str
    is_active: bool
    created_at: datetime
    last_scraped_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TopicCreate(BaseModel):
    name: str

class TopicOut(BaseModel):
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True

class CompanyOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    founded_year: Optional[str] = None
    funding_stage: Optional[str] = None
    funding_amount: Optional[str] = None
    is_seen: bool
    is_new: bool
    discovered_at: datetime

    class Config:
        from_attributes = True

class ScanResult(BaseModel):
    scan_id: int
    sources_scanned: int
    new_companies_found: int
    status: str
    companies: list[CompanyOut]

class DashboardStats(BaseModel):
    total_companies: int
    new_companies: int
    total_sources: int
    active_topics: int
    last_scan: Optional[datetime] = None


# ──────────────────────── Sources ────────────────────────

@app.get("/api/sources", response_model=list[SourceOut])
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).order_by(Source.created_at.desc()).all()


@app.post("/api/sources", response_model=SourceOut)
def add_source(data: SourceCreate, db: Session = Depends(get_db)):
    existing = db.query(Source).filter(Source.url == data.url).first()
    if existing:
        raise HTTPException(400, "This URL is already added as a source")

    source = Source(name=data.name, url=data.url)
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@app.delete("/api/sources/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "Source not found")
    db.delete(source)
    db.commit()
    return {"ok": True}


@app.patch("/api/sources/{source_id}/toggle")
def toggle_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "Source not found")
    source.is_active = not source.is_active
    db.commit()
    return {"ok": True, "is_active": source.is_active}


# ──────────────────────── Topics ────────────────────────

@app.get("/api/topics", response_model=list[TopicOut])
def list_topics(db: Session = Depends(get_db)):
    return db.query(Topic).order_by(Topic.name).all()


@app.post("/api/topics", response_model=TopicOut)
def add_topic(data: TopicCreate, db: Session = Depends(get_db)):
    existing = db.query(Topic).filter(Topic.name == data.name).first()
    if existing:
        raise HTTPException(400, "This topic already exists")

    topic = Topic(name=data.name)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


@app.delete("/api/topics/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(404, "Topic not found")
    db.delete(topic)
    db.commit()
    return {"ok": True}


@app.patch("/api/topics/{topic_id}/toggle")
def toggle_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(404, "Topic not found")
    topic.is_active = not topic.is_active
    db.commit()
    return {"ok": True, "is_active": topic.is_active}


# ──────────────────────── Scanning ────────────────────────

@app.post("/api/scan", response_model=ScanResult)
async def run_scan(db: Session = Depends(get_db)):
    """Scan all active sources for new companies."""
    sources = db.query(Source).filter(Source.is_active == True).all()
    if not sources:
        raise HTTPException(400, "No active sources configured. Add sources first.")

    active_topics = db.query(Topic).filter(Topic.is_active == True).all()
    topic_names = [t.name for t in active_topics]

    # Create scan log
    scan = ScanLog(status="running")
    db.add(scan)
    db.commit()

    new_companies = []
    sources_scanned = 0

    for source in sources:
        try:
            scraped = await scrape_source(
                url=source.url,
                source_name=source.name,
                topics=topic_names if topic_names else None,
            )
            sources_scanned += 1
            source.last_scraped_at = datetime.utcnow()

            for sc in scraped:
                # Dedup: check if company name already exists (case-insensitive)
                existing = db.query(Company).filter(
                    Company.name.ilike(sc.name)
                ).first()
                if existing:
                    continue

                company = Company(
                    name=sc.name,
                    description=sc.description,
                    website=sc.website,
                    source_url=sc.source_url,
                    source_name=sc.source_name,
                    industry=sc.industry,
                    location=sc.location,
                    founded_year=sc.founded_year,
                    funding_stage=sc.funding_stage,
                    funding_amount=sc.funding_amount,
                    is_new=True,
                    is_seen=False,
                )

                # Link topics
                for topic in active_topics:
                    searchable = f"{sc.name} {sc.description} {sc.industry}".lower()
                    if topic.name.lower() in searchable:
                        company.topics.append(topic)

                db.add(company)
                new_companies.append(company)

        except Exception as e:
            print(f"Error scraping {source.url}: {e}")
            continue

    db.commit()

    scan.finished_at = datetime.utcnow()
    scan.sources_scanned = sources_scanned
    scan.new_companies_found = len(new_companies)
    scan.status = "completed"
    db.commit()

    # Refresh all companies so their IDs are populated
    for c in new_companies:
        db.refresh(c)

    return ScanResult(
        scan_id=scan.id,
        sources_scanned=sources_scanned,
        new_companies_found=len(new_companies),
        status="completed",
        companies=[CompanyOut.model_validate(c) for c in new_companies],
    )


# ──────────────────────── Companies ────────────────────────

@app.get("/api/companies", response_model=list[CompanyOut])
def list_companies(
    new_only: bool = Query(False),
    topic: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Company).order_by(Company.discovered_at.desc())

    if new_only:
        q = q.filter(Company.is_new == True)

    if search:
        q = q.filter(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.description.ilike(f"%{search}%"),
                Company.industry.ilike(f"%{search}%"),
            )
        )

    return q.all()


@app.patch("/api/companies/{company_id}/mark-seen")
def mark_seen(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    company.is_seen = True
    company.is_new = False
    db.commit()
    return {"ok": True}


@app.patch("/api/companies/mark-all-seen")
def mark_all_seen(db: Session = Depends(get_db)):
    db.query(Company).filter(Company.is_new == True).update(
        {"is_new": False, "is_seen": True}
    )
    db.commit()
    return {"ok": True}


@app.delete("/api/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    db.delete(company)
    db.commit()
    return {"ok": True}


# ──────────────────────── Export ────────────────────────

@app.get("/api/export/excel")
def export_excel(
    new_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Export companies to Excel file."""
    q = db.query(Company).order_by(Company.discovered_at.desc())
    if new_only:
        q = q.filter(Company.is_new == True)

    companies = q.all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Companies"

    # Header
    headers = [
        "Name", "Description", "Website", "Industry", "Location",
        "Founded Year", "Funding Stage", "Funding Amount",
        "Source", "Source URL", "Discovered At", "Status"
    ]
    ws.append(headers)

    # Style headers
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = cell.font.copy(bold=True)

    # Data
    for c in companies:
        ws.append([
            c.name,
            c.description or "",
            c.website or "",
            c.industry or "",
            c.location or "",
            c.founded_year or "",
            c.funding_stage or "",
            c.funding_amount or "",
            c.source_name or "",
            c.source_url or "",
            c.discovered_at.strftime("%Y-%m-%d %H:%M") if c.discovered_at else "",
            "New" if c.is_new else "Seen",
        ])

    # Auto-width columns
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    # Write to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"vc_scout_companies_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ──────────────────────── Dashboard ────────────────────────

@app.get("/api/dashboard", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    total = db.query(Company).count()
    new = db.query(Company).filter(Company.is_new == True).count()
    sources = db.query(Source).count()
    topics = db.query(Topic).filter(Topic.is_active == True).count()

    last_scan = db.query(ScanLog).order_by(ScanLog.started_at.desc()).first()

    return DashboardStats(
        total_companies=total,
        new_companies=new,
        total_sources=sources,
        active_topics=topics,
        last_scan=last_scan.started_at if last_scan else None,
    )


# ──────────────────────── Seed Data ────────────────────────

@app.post("/api/seed")
def seed_default_topics(db: Session = Depends(get_db)):
    """Seed default topics for Turkish startup ecosystem."""
    default_topics = [
        "Fintech", "SaaS", "E-ticaret", "Sağlık Teknolojisi", "Eğitim Teknolojisi",
        "Yapay Zeka", "Blockchain", "Oyun", "Lojistik", "Tarım Teknolojisi",
        "Sigorta Teknolojisi", "Emlak Teknolojisi", "Gıda Teknolojisi",
        "Enerji", "Siber Güvenlik", "IoT", "Robotik", "Biyoteknoloji",
        "AI", "Machine Learning", "HealthTech", "EdTech", "AgriTech",
        "DeepTech", "CleanTech", "PropTech", "InsurTech", "FoodTech",
    ]

    added = 0
    for name in default_topics:
        existing = db.query(Topic).filter(Topic.name == name).first()
        if not existing:
            db.add(Topic(name=name))
            added += 1

    db.commit()
    return {"ok": True, "topics_added": added}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
