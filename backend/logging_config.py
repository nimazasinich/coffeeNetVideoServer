"""
SmartCopy — Logging Configuration
JSON-structured logs with rotating file handler.
"""
import logging
import logging.handlers
import json
from datetime import datetime, timezone
from backend.config import LOG_DIR, LOG_LEVEL, LOG_MAX_BYTES, LOG_BACKUP_COUNT


class JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        # If msg is already a dict, use it as payload
        if isinstance(record.msg, dict):
            payload = record.msg
        else:
            payload = {"message": record.getMessage()}

        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level":     record.levelname,
            "logger":    record.name,
            **payload,
        }

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Strip sensitive keys
        for sensitive in ("password", "password_hash", "token", "secret", "authorization"):
            if sensitive in log_entry:
                log_entry[sensitive] = "***"

        return json.dumps(log_entry, default=str)


def setup_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))

    # Console handler
    console = logging.StreamHandler()
    console.setFormatter(JsonFormatter())
    root.addHandler(console)

    # Rotating file handler
    file_handler = logging.handlers.RotatingFileHandler(
        filename   = LOG_DIR / "smartcopy.log",
        maxBytes   = LOG_MAX_BYTES,
        backupCount= LOG_BACKUP_COUNT,
        encoding   = "utf-8"
    )
    file_handler.setFormatter(JsonFormatter())
    root.addHandler(file_handler)

    # Suppress noisy third-party loggers
    for noisy in ("uvicorn.access", "watchfiles"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
