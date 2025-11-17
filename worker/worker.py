from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
from typing import Any, Dict, Optional

import psycopg
import redis
import requests

from config import settings

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("worker")

_STOP = False


def _signal_handler(signum, frame):
    global _STOP
    logger.info("Caught signal %s, initiating graceful shutdown", signum)
    _STOP = True


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


def get_db_connection():
    """Get PostgreSQL connection"""
    return psycopg.connect(settings.database_url)


def parse_job(raw: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(raw)
    except Exception as e:
        logger.error("Invalid job payload: %s", raw[:200])
        return None


def process_document(job: Dict[str, Any]) -> None:
    """Process a document generation job"""
    document_id = job.get("documentId") or job.get("document_id")
    template = job.get("template")
    placeholders = job.get("placeholders", {})
    metadata = job.get("metadata", {})

    if not document_id or not template:
        raise ValueError("Job missing required fields: documentId and template")

    conn = get_db_connection()
    try:
        # Update status to processing
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE documents SET status = %s WHERE document_id = %s",
                ("processing", document_id)
            )
        conn.commit()

        # Call backend API to generate document
        api_url = f"{settings.backend_api_url}/api/v1/documents/internal/generate"
        response = requests.post(
            api_url,
            json={
                "documentId": document_id,
                "template": template,
                "placeholders": placeholders,
                "metadata": metadata,
            },
            timeout=300,  # 5 minutes timeout
        )
        response.raise_for_status()

        result = response.json()
        logger.info("✅ Document %s processed successfully", document_id)

        # Update document status
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE documents SET status = %s, pdf_path = %s WHERE document_id = %s",
                ("completed", result.get("pdf_path"), document_id)
            )
        conn.commit()

    except Exception as e:
        logger.exception("❌ Error processing document %s: %s", document_id, e)
        
        # Update document status to failed
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE documents SET status = %s, error_message = %s WHERE document_id = %s",
                    ("failed", str(e), document_id)
                )
            conn.commit()
        except Exception:
            pass
        
        raise
    finally:
        conn.close()


def run_once(r: redis.Redis, queue: str, dlq: str) -> bool:
    """Process a single job from the queue"""
    resp = r.blpop(queue, timeout=5)
    if resp is None:
        return False

    _q, item = resp
    raw = item.decode("utf-8") if isinstance(item, (bytes, bytearray)) else str(item)
    logger.info("📥 Picked job payload: %s", raw[:200])
    
    job = parse_job(raw)
    if not job or not isinstance(job, dict):
        logger.error("Invalid job payload: %s", raw[:200])
        return True

    document_id = job.get("documentId") or job.get("document_id")
    if not document_id:
        logger.error("Job missing 'documentId': %s", raw[:200])
        return True

    try:
        process_document(job)
    except Exception as exc:
        logger.exception("Job failed: %s", exc)
        retries = int(job.get("retries", 0))
        if retries + 1 >= settings.max_retries:
            job["error"] = str(exc)
            job["failed_at"] = int(time.time())
            r.rpush(dlq, json.dumps(job))
            logger.error("💀 Job %s moved to DLQ after %d retries", document_id, settings.max_retries)
        else:
            job["retries"] = retries + 1
            r.rpush(queue, json.dumps(job))
            logger.warning("⚠️  Job %s failed, retrying (%d/%d)", document_id, retries + 1, settings.max_retries)
        return True

    return True


def main() -> None:
    client = redis.from_url(settings.redis_url)
    queue = settings.redis_queue
    dlq = settings.redis_dead_letter_queue

    logger.info("Worker started. Queue=%s DLQ=%s", queue, dlq)
    while not _STOP:
        processed = run_once(client, queue, dlq)
        if not processed:
            continue

    logger.info("Worker stopping")
    client.close()


if __name__ == "__main__":
    main()

