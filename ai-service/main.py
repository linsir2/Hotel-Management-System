from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import nl_search, anomaly, pricing, note_suggest, forecast
from config import settings

logger = logging.getLogger("uvicorn")

_app_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up the embedding model + template vectors at startup."""
    logger.info("🔥 Downloading & loading embedding model...")
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_app_pool, nl_search.warmup)
        logger.info("✅ Model warmup complete")
    except Exception as e:
        logger.error(f"❌ Warmup failed: {e}")
    yield
    _app_pool.shutdown(wait=False)
    logger.info("🛑 Shutting down AI service")


app = FastAPI(
    title="Hotel AI Service",
    description="AI-powered features for Hotel Management System",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(nl_search.router, prefix="/nl-search", tags=["NL Search"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["Anomaly Detection"])
app.include_router(pricing.router, prefix="/price-recs", tags=["Pricing Recommendations"])
app.include_router(note_suggest.router, prefix="/note-suggest", tags=["Note Suggestions"])
app.include_router(forecast.router, prefix="/forecast", tags=["Revenue Forecast"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "hotel-ai-service", "version": "0.1.0"}


@app.get("/")
async def root():
    return {
        "service": "Hotel AI Service",
        "endpoints": {
            "/nl-search/search": "Natural language search (POST)",
            "/anomaly/scan": "Run all anomaly detection rules",
            "/anomaly/types": "List anomaly rule types",
            "/price-recs/recommendations": "Pricing recommendations (GET)",
            "/note-suggest/suggest": "Note template suggestions (GET)",
            "/forecast/revenue": "Weekly revenue forecast (GET)",
            "/health": "Health check",
        },
    }
