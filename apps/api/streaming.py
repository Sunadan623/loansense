"""
Streaming + caching layer for LoanSense.
- Kafka producer: publishes behavioral events to a topic (non-blocking capture)
- Kafka consumer: background thread that ingests events into Postgres (decoupled storage)
- Redis: cache-aside helpers for hot read paths
Everything degrades gracefully: if Kafka/Redis are down, the app still works.
"""
import os
import json
import threading
import time
from datetime import datetime

def _env(key, default=None):
    """Read env var; fall back to parsing .env directly if empty (robust against shadowing)."""
    val = os.getenv(key)
    if val:
        return val
    try:
        from dotenv import dotenv_values
        for path in (".env", "../.env", "../../.env"):
            if os.path.exists(path):
                v = dotenv_values(path).get(key)
                if v:
                    return v
    except Exception:
        pass
    return default

KAFKA_BROKER = _env("KAFKA_BROKER", "localhost:9092")
KAFKA_API_KEY = _env("KAFKA_API_KEY")        # set for Confluent Cloud
KAFKA_API_SECRET = _env("KAFKA_API_SECRET")  # set for Confluent Cloud
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
EVENTS_TOPIC = "loansense-events"

def _kafka_auth_config():
    """Return SASL_SSL auth kwargs if Confluent creds are set, else empty (local plaintext)."""
    if KAFKA_API_KEY and KAFKA_API_SECRET:
        return {
            "security_protocol": "SASL_SSL",
            "sasl_mechanism": "PLAIN",
            "sasl_plain_username": KAFKA_API_KEY,
            "sasl_plain_password": KAFKA_API_SECRET,
        }
    return {}

# ---------------- Kafka Producer ----------------
_producer = None

def get_producer():
    global _producer
    if _producer is not None:
        return _producer
    try:
        from kafka import KafkaProducer
        _producer = KafkaProducer(
            bootstrap_servers=KAFKA_BROKER,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            retries=2,
            request_timeout_ms=10000,
            max_block_ms=10000,
            **_kafka_auth_config(),
        )
        print(f"✓ Kafka producer connected to {KAFKA_BROKER}")
    except Exception as e:
        print(f"⚠ Kafka producer unavailable: {e}")
        _producer = None
    return _producer

def publish_event(event: dict):
    """Publish an event to Kafka. Returns True if sent, False if fell back."""
    prod = get_producer()
    if prod is None:
        return False
    try:
        prod.send(EVENTS_TOPIC, event)
        return True
    except Exception as e:
        print(f"⚠ Kafka publish failed: {e}")
        return False

# ---------------- Kafka Consumer (background) ----------------
_consumer_thread = None
_consumer_stop = False

def start_consumer(session_factory, event_model):
    """Start a background thread consuming events → Postgres.
    session_factory: callable returning a new SQLAlchemy session
    event_model: the Event SQLAlchemy class
    """
    global _consumer_thread
    if _consumer_thread is not None:
        return

    def _consume():
        from kafka import KafkaConsumer
        # Retry connecting a few times (Kafka may still be warming up)
        consumer = None
        for attempt in range(5):
            try:
                consumer = KafkaConsumer(
                    EVENTS_TOPIC,
                    bootstrap_servers=KAFKA_BROKER,
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    group_id="loansense-event-ingest",
                    auto_offset_reset="earliest",
                    enable_auto_commit=True,
                    consumer_timeout_ms=1000,
                    **_kafka_auth_config(),
                )
                print(f"✓ Kafka consumer connected (group loansense-event-ingest)")
                break
            except Exception as e:
                print(f"⚠ Consumer connect attempt {attempt+1} failed: {e}")
                time.sleep(3)
        if consumer is None:
            print("✗ Kafka consumer could not connect; event ingestion disabled")
            return

        while not _consumer_stop:
            try:
                for msg in consumer:
                    if _consumer_stop:
                        break
                    ev = msg.value
                    s = session_factory()
                    try:
                        row = event_model(
                            user_id=ev.get("user_id"),
                            event_type=ev.get("event_type"),
                            event_category=ev.get("event_category"),
                            loan_id=ev.get("loan_id"),
                            event_metadata=ev.get("metadata"),
                            ip_address=ev.get("ip_address"),
                        )
                        s.add(row)
                        s.commit()
                    except Exception as e:
                        print(f"⚠ Event ingest failed: {e}")
                        s.rollback()
                    finally:
                        s.close()
            except Exception as e:
                if not _consumer_stop:
                    print(f"⚠ Consumer loop error: {e}")
                    time.sleep(2)
        consumer.close()

    _consumer_thread = threading.Thread(target=_consume, daemon=True)
    _consumer_thread.start()

# ---------------- Redis cache ----------------
_redis = None

def get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis as redis_lib
        _redis = redis_lib.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        _redis.ping()
        _host = REDIS_URL.split("@")[-1] if "@" in REDIS_URL else REDIS_URL
        print(f"✓ Redis connected to {_host}")
    except Exception as e:
        print(f"⚠ Redis unavailable: {e}")
        _redis = None
    return _redis

def cache_get(key: str):
    r = get_redis()
    if r is None:
        return None
    try:
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None

def cache_set(key: str, value, ttl_seconds: int = 60):
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception:
        pass

def cache_invalidate(pattern: str):
    """Delete keys matching a prefix pattern (e.g. 'analytics:*')."""
    r = get_redis()
    if r is None:
        return
    try:
        for key in r.scan_iter(match=pattern):
            r.delete(key)
    except Exception:
        pass
