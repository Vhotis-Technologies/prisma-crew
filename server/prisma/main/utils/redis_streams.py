"""
Redis Streams helper for job_events stream.
Uses consumer groups for at-least-once delivery and no message loss during restarts.
"""
import os
import redis

REDIS_HOST = os.environ.get("REDIS_HOST", "prisma_redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_DB = int(os.environ.get("REDIS_DB", "0"))

STREAM_JOB_EVENTS = "job_events"
MAXLEN_DEFAULT = 10000


def get_redis(decode_responses=True, socket_timeout=None):
    """
    Return a Redis connection using environment host/port/db.

    Args:
        decode_responses: When True, stream field values are str.
        socket_timeout: Socket read timeout in seconds. Blocking stream reads
            must use a value greater than ``block_ms``.
    """
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        decode_responses=decode_responses,
        socket_connect_timeout=5,
        socket_timeout=socket_timeout,
        health_check_interval=0,
    )


def stream_add(stream_key, data_dict, maxlen=MAXLEN_DEFAULT):
    """
    Append a message to a stream. Flattens dict to Redis field/value (strings).
    Returns message id.
    """
    r = get_redis(decode_responses=False)
    import json
    flat = {}
    for k, v in data_dict.items():
        if isinstance(v, str):
            flat[k] = v
        elif isinstance(v, (dict, list)):
            flat[k] = json.dumps(v)
        else:
            flat[k] = str(v) if v is not None else ""
    try:
        msg_id = r.xadd(stream_key, flat, maxlen=maxlen, approximate=True)
        return msg_id.decode("utf-8") if isinstance(msg_id, bytes) else msg_id
    finally:
        r.close()


def ensure_consumer_group(stream_key, group_name):
    """
    Create consumer group if it does not exist. Idempotent: catches BUSYGROUP.
    Uses 0 as start id so new group reads from beginning; MKSTREAM creates stream if missing.
    """
    r = get_redis(decode_responses=True)
    try:
        r.xgroup_create(stream_key, group_name, id="0", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise
    finally:
        r.close()


def read_group_blocking(stream_key, group_name, consumer_name, block_ms=5000):
    """
    Block until new messages arrive. Returns list of (message_id, fields_dict).
    Socket timeout exceeds BLOCK so an empty stream returns [] instead of TimeoutError.
    """
    socket_timeout = (block_ms / 1000.0) + 5.0 if block_ms else None
    r = get_redis(decode_responses=True, socket_timeout=socket_timeout)
    try:
        reply = r.xreadgroup(
            groupname=group_name,
            consumername=consumer_name,
            streams={stream_key: ">"},
            block=block_ms,
            count=100,
        )
    except redis.exceptions.TimeoutError:
        return []
    finally:
        r.close()
    if not reply:
        return []
    entries = reply[0][1] if reply else []
    return [(eid, dict(fields)) for eid, fields in entries]


def read_pending(stream_key, group_name, consumer_name):
    """
    Read pending messages for this consumer (e.g. on startup). Returns list of (message_id, fields_dict).
    """
    r = get_redis(decode_responses=True)
    try:
        reply = r.xreadgroup(
            groupname=group_name,
            consumername=consumer_name,
            streams={stream_key: "0"},
            count=100,
        )
    finally:
        r.close()
    if not reply:
        return []
    entries = reply[0][1] if reply else []
    return [(eid, dict(fields)) for eid, fields in entries]


def ack(stream_key, group_name, message_id):
    """Acknowledge a message so it is not redelivered."""
    r = get_redis(decode_responses=True)
    try:
        r.xack(stream_key, group_name, message_id)
    finally:
        r.close()


class RedisStreamConsumer:
    """Long-lived Redis client for a subscriber loop (one connection, reused)."""

    def __init__(self, block_ms=5000):
        socket_timeout = (block_ms / 1000.0) + 5.0 if block_ms else None
        self.block_ms = block_ms
        self._r = get_redis(decode_responses=True, socket_timeout=socket_timeout)

    def read_group_blocking(self, stream_key, group_name, consumer_name, block_ms=None):
        """Block-read new group entries on the reused connection."""
        block = self.block_ms if block_ms is None else block_ms
        try:
            reply = self._r.xreadgroup(
                groupname=group_name,
                consumername=consumer_name,
                streams={stream_key: ">"},
                block=block,
                count=100,
            )
        except redis.exceptions.TimeoutError:
            return []
        if not reply:
            return []
        entries = reply[0][1] if reply else []
        return [(eid, dict(fields)) for eid, fields in entries]

    def read_pending(self, stream_key, group_name, consumer_name):
        """Read this consumer's pending entries on the reused connection."""
        reply = self._r.xreadgroup(
            groupname=group_name,
            consumername=consumer_name,
            streams={stream_key: "0"},
            count=100,
        )
        if not reply:
            return []
        entries = reply[0][1] if reply else []
        return [(eid, dict(fields)) for eid, fields in entries]

    def ack(self, stream_key, group_name, message_id):
        """Acknowledge one message on the reused connection."""
        self._r.xack(stream_key, group_name, message_id)

    def pending_count(self, stream_key, group_name):
        """Return the group's pending (unacked) entry count."""
        info = self._r.xpending(stream_key, group_name)
        if not info:
            return 0
        if isinstance(info, dict):
            return int(info.get("pending") or 0)
        return int(info[0] or 0)

    def close(self):
        """Close the reused Redis connection."""
        try:
            self._r.close()
        except Exception:
            pass
