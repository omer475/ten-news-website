"""Database models and setup for VC Scout."""

from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean,
    DateTime, ForeignKey, Table, inspect
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///./vc_scout.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Many-to-many: companies <-> topics
company_topics = Table(
    "company_topics",
    Base.metadata,
    Column("company_id", Integer, ForeignKey("companies.id")),
    Column("topic_id", Integer, ForeignKey("topics.id")),
)


class Source(Base):
    """A website URL that lists startups/companies."""
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False, unique=True)
    listing_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_scraped_at = Column(DateTime, nullable=True)


class Topic(Base):
    """An industry/topic to filter companies by."""
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Company(Base):
    """A discovered company/startup."""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    source_url = Column(String(500), nullable=True)
    source_name = Column(String(200), nullable=True)
    industry = Column(String(200), nullable=True)
    location = Column(String(200), nullable=True)
    founded_year = Column(String(10), nullable=True)
    funding_stage = Column(String(100), nullable=True)
    funding_amount = Column(String(100), nullable=True)
    is_seen = Column(Boolean, default=False)  # User has reviewed this
    is_new = Column(Boolean, default=True)     # Newly discovered
    discovered_at = Column(DateTime, default=datetime.utcnow)
    topics = relationship("Topic", secondary=company_topics, backref="companies")


class ScanLog(Base):
    """Log of each scan run."""
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    sources_scanned = Column(Integer, default=0)
    new_companies_found = Column(Integer, default=0)
    status = Column(String(50), default="running")  # running, completed, failed
    error_message = Column(Text, nullable=True)


def init_db():
    """Create all tables and run lightweight migrations."""
    Base.metadata.create_all(bind=engine)
    _migrate_sources_listing_url()


def _migrate_sources_listing_url():
    """Add listing_url column to sources if missing (for existing databases)."""
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns("sources")]
    if "listing_url" not in columns:
        with engine.connect() as conn:
            conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE sources ADD COLUMN listing_url VARCHAR(500)"
                )
            )
            conn.commit()


def get_db():
    """Dependency for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
