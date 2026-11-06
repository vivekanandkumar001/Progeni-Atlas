"""Shared integrity event counting and request-idempotency helpers."""

PROCTORING_EVENT_WEIGHTS = {
    "multiple_faces": 3,
    "unauthorized_action": 3,
    "no_face": 2,
    "face_out_of_frame": 2,
    "fullscreen_exit": 2,
}


def event_type_value(event_type) -> str:
    return event_type.value if hasattr(event_type, "value") else str(event_type)


def weighted_warning_count(events, weights=None) -> int:
    """Count WARNING/CRITICAL rows, applying documented event weights."""
    configured = weights or PROCTORING_EVENT_WEIGHTS
    return sum(configured.get(event_type_value(ev.event_type), 1) for ev in events)


def has_client_event_id(events, event_id: str) -> bool:
    """Detect a request retry using the idempotency key stored with its event."""
    return any((getattr(ev, "metadata_json", None) or {}).get("client_event_id") == event_id for ev in events)


def should_suppress_recent_same_type_event(event_id: str, seconds_since_last) -> bool:
    """Keep the legacy time-window guard only for requests without an idempotency key."""
    if event_id or seconds_since_last is None:
        return False
    return 0 <= seconds_since_last < 1.0
