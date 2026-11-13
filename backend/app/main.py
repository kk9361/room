import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError, PyMongoError
from starlette.exceptions import HTTPException

from app.api.v1 import admin, auth, ledger, reports, rooms
from app.core.config import Settings
from app.core.errors import DomainError
from app.core.security import uid
from app.database.connection import bootstrap, client_for, indexes

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("roommate")
# Uvicorn's default access line includes query strings, which may contain private
# expense searches. The structured request logger below deliberately records paths only.
logging.getLogger("uvicorn.access").disabled = True


def create_app(settings=None, database=None):
    config = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        client = None
        app.state.ready = False
        try:
            if database is None:
                client = client_for(config)
                app.state.db = client[config.mongodb_database]
                await app.state.db.command("ping")
            else:
                app.state.db = database
            await indexes(app.state.db)
            await bootstrap(app.state.db, config)
            app.state.ready = True
            logger.info('{"event":"database_ready"}')
        except (PyMongoError, ValueError):
            # Connection exceptions can contain URIs. Never emit their text.
            logger.error('{"event":"database_unavailable","action":"check_backend_configuration"}')
        yield
        if client:
            await client.close()

    app = FastAPI(title="RoomMate Ledger API", version="1.0.0", lifespan=lifespan)
    app.state.settings = config
    app.state.ready = False
    origins = [origin.strip() for origin in config.cors_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
    )

    def error(request, status, code, message, details=None):
        return JSONResponse(
            status_code=status,
            content={
                "error": {
                    "code": code,
                    "message": message,
                    "details": details or [],
                    "request_id": getattr(request.state, "request_id", ""),
                }
            },
        )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        import json

        request.state.request_id = uid()
        start = time.monotonic()
        if request.method in ("POST", "PATCH", "DELETE"):
            origin = request.headers.get("origin")
            if origin and origin not in origins:
                return error(request, 403, "ORIGIN_REJECTED", "Request origin is not allowed")
            chunks, size = [], 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 65536:
                    return error(request, 413, "BODY_TOO_LARGE", "Request body exceeds 64 KB")
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        logger.info(
            json.dumps(
                {
                    "event": "request",
                    "request_id": request.state.request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.monotonic() - start) * 1000),
                }
            )
        )
        return response

    @app.exception_handler(DomainError)
    async def domain_error(request, exc):
        return error(request, exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        details = [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()]
        return error(request, 422, "VALIDATION_ERROR", "Please check the submitted fields", details)

    @app.exception_handler(DuplicateKeyError)
    async def duplicate_error(request, exc):
        return error(request, 409, "CONFLICT", "A record with these details already exists")

    @app.exception_handler(PyMongoError)
    async def database_error(request, exc):
        return error(
            request, 503, "DATABASE_UNAVAILABLE", "Database is temporarily unavailable. Please retry."
        )

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error(
            request,
            exc.status_code,
            "HTTP_ERROR",
            "Route not found" if exc.status_code == 404 else str(exc.detail),
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):
        logger.error(
            '{"event":"unexpected_error","request_id":"%s","type":"%s"}',
            getattr(request.state, "request_id", ""),
            type(exc).__name__,
        )
        return error(
            request, 500, "INTERNAL_ERROR", "An unexpected error occurred. Use the request ID for support."
        )

    @app.get("/api/v1/health", tags=["Health"])
    async def health():
        return {"status": "ok", "version": "1.0.0"}

    @app.get("/api/v1/health/ready", tags=["Health"])
    async def ready(request: Request):
        try:
            if not app.state.ready:
                return error(request, 503, "NOT_READY", "Database initialization has not succeeded")
            await app.state.db.command("ping")
        except PyMongoError:
            return error(request, 503, "NOT_READY", "Database is unavailable")
        return {"status": "ready", "database": config.mongodb_database}

    for router in (auth.router, rooms.router, ledger.router, reports.router, admin.router):
        app.include_router(router, prefix="/api/v1")
    return app


app = create_app()
