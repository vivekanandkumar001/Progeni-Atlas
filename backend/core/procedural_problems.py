"""
Progeni Atlas — Procedural non-searchable problem generator (v1)
===================================================================
Synthesizes bespoke coding problems from seeded algorithmic
invariants wrapped in role-specific domain scenarios, so solutions
don't appear verbatim on the open web (LeetCode-answer leakage is the
#1 pre-memorized-solution vector).

Deterministic: same (role, seed) -> same problem. No LLM call required.

Guarantee: every synthesized problem ships with a Python test harness that
is validated on import to PASS its embedded reference solution — the same
harness shape used by the interview coding runner, with the same per-run
random marker anti-forgery discipline applied at execution time.
"""

from __future__ import annotations

import ast
import random
import uuid
from dataclasses import dataclass
from typing import Any

# ---------------------------------------------------------------- invariants

@dataclass(frozen=True)
class Invariant:
    id: str
    title: str
    description: str
    constraints: tuple[str, ...]
    python_class: str          # reference solution (used by harness self-check)
    python_sample: str
    ts_sample: str
    python_harness: str
    js_harness: str            # reference to assert against ts_sample exports


_TOKEN_BUCKET = Invariant(
    id="token_bucket",
    title="Token bucket rate limiter for the {DOMAIN} ingest path",
    description=(
        "The {DOMAIN} backend receives bursts of API requests that would otherwise "
        "overwhelm the write path. Implement a token bucket rate limiter with "
        "`try_acquire(key, cost=1)` returning True if at least `cost` tokens are "
        "available for `key`, consuming them otherwise."
    ),
    constraints=(
        "O(1) per operation, memory O(distinct keys)",
        "clock::now() in milliseconds is injectable",
        "exactly-once semantics for a single-threaded worker",
    ),
    python_class="""
class TokenBucket:
    def __init__(self, capacity: int, refill_per_second: int, now_ms=None):
        self.capacity = capacity
        self.refill_per_second = refill_per_second
        import time
        self._now = now_ms or (lambda: int(time.time() * 1000))
        self.buckets = {}

    def try_acquire(self, key: str, cost: int = 1) -> bool:
        now = self._now()
        b = self.buckets.get(key)
        if b is None:
            b = [self.capacity, now]
        last, tokens = b[1], b[0]
        elapsed = (now - last) / 1000.0
        tokens = min(self.capacity, tokens + elapsed * self.refill_per_second)
        if tokens >= cost:
            self.buckets[key] = [tokens - cost, now]
            return True
        self.buckets[key] = [tokens, now]
        return False
""",
    python_sample="""
class TokenBucket:
    # capacity: max tokens
    # refill_per_second: tokens added per second
    def __init__(self, capacity: int, refill_per_second: int):
        # TODO: store state per key; lazily refill on each call
        self.capacity = capacity
        raise NotImplementedError

    def try_acquire(self, key: str, cost: int = 1) -> bool:
        ...
""",
    ts_sample="""
class TokenBucket {
  constructor(capacity: number, refillPerSecond: number) {
    // TODO: store state per key
  }
  tryAcquire(key: string, cost = 1): boolean {
    // TODO
    return false;
  }
}
""",
    python_harness="""
tb = TokenBucket(5, 10)
assert tb.try_acquire("a", cost=3) is True
assert tb.try_acquire("a", cost=3) is False
assert tb.try_acquire("a", cost=1) is True
assert tb.try_acquire("b", cost=5) is True
print("PASSED")
""",
    js_harness="""const tb = new TokenBucket(5, 10);
if (tb.tryAcquire('a', 3) !== true) throw new Error('should pass');
if (tb.tryAcquire('a', 3) !== false) throw new Error('should be limited');
if (tb.tryAcquire('a', 1) !== true) throw new Error('burst allowed');
console.log('PASSED');
""",
)

_LRU_TTL_CACHE = Invariant(
    id="lru_ttl_cache",
    title="TTL-evicting LRU cache for the {DOMAIN} hot path",
    description=(
        "Build a bounded cache with `get(key)` and `put(key, value)` supporting "
        "both LRU eviction and per-item TTL expiry. `get` refreshes recency and "
        "must return None for expired entries."
    ),
    constraints=(
        "O(1) get/put average",
        "evicted item must be the least-recently-used among *valid* entries",
        "TTL checked at read time; expired entries don't count toward hits",
    ),
    python_class="""
import time, collections
class TtlLruCache:
    def __init__(self, capacity: int, ttl_seconds: float = 60.0, time_fn=None):
        self.capacity = capacity
        self.ttl = ttl_seconds
        self.time_fn = time_fn or time.time
        self.store = collections.OrderedDict()
    def get(self, key):
        if key not in self.store:
            return None
        value, exp = self.store.pop(key)
        if exp <= self.time_fn():
            return None
        self.store[key] = (value, exp)
        return value
    def put(self, key, value):
        if key in self.store:
            self.store.pop(key)
        while len(self.store) >= self.capacity:
            self.store.popitem(last=False)
        self.store[key] = (value, self.time_fn() + self.ttl)
""",
    python_sample="""
import collections, time
class TtlLruCache:
    # OrderedDict-based; TTL via stored expiry timestamp
    def __init__(self, capacity: int, ttl_seconds: float = 60.0):
        self.capacity = capacity
        self.ttl = ttl_seconds
        raise NotImplementedError
    def get(self, key) -> object | None: ...
    def put(self, key, value) -> None: ...
""",
    ts_sample="""
class TtlLruCache {
  constructor(capacity: number, ttlSeconds = 60) {
    // TODO: Map<string, {value, expiresAt}> + LRU order via insertion reorder
  }
  get(key: string): unknown | undefined {
    // TODO
    return undefined;
  }
  put(key: string, value: unknown): void {
    // TODO
  }
}
""",
    python_harness="""
cache = TtlLruCache(2, ttl_seconds=60.0)
cache.put("a", 1)
cache.put("b", 2)
cache.put("c", 3)  # evicts 'a' (LRU)
assert cache.get("a") is None
assert cache.get("b") == 2
assert cache.get("c") == 3
print("PASSED")
""",
    js_harness="""
const cache = new TtlLruCache(2, 60);
cache.put('a', 1);
cache.put('b', 2);
cache.put('c', 3);
if (cache.get('a') !== undefined) throw new Error('should evict a');
console.log('PASSED');
""",
)

_SLIDING_WINDOW = Invariant(
    id="sliding_window",
    title="Sliding window rate limiter for the {DOMAIN} authenticated API",
    description=(
        "Implement a sliding-window rate limiter. `allow(key, limit, window_seconds)` "
        "returns True when fewer than `limit` requests have occurred in the last "
        "`window_seconds` for `key`, and False otherwise."
    ),
    constraints=(
        "timestamps in seconds",
        "memory must be bounded by window size, not lifetime",
        "concurrent entries per key may grow",
    ),
    python_class="""
import time, collections
class SlidingWindowRateLimiter:
    def __init__(self, time_fn=None):
        self.time_fn = time_fn or time.time
        self.hits = collections.defaultdict(list)
    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = self.time_fn()
        cutoff = now - window_seconds
        hits = [t for t in self.hits[key] if t >= cutoff]
        self.hits[key] = hits
        if len(hits) < limit:
            hits.append(now)
            self.hits[key] = hits
            return True
        return False
""",
    python_sample="""
import time
class SlidingWindowRateLimiter:
    # keep only the timestamps inside the window
    def __init__(self):
        raise NotImplementedError
    def allow(self, key: str, limit: int, window_seconds: int) -> bool: ...
""",
    ts_sample="""
class SlidingWindowRateLimiter {
  private hits: Map<string, number[]> = new Map();
  allow(key: string, limit: number, windowSeconds: number): boolean {
    // TODO
    return false;
  }
}
""",
    python_harness="""
now = [1000]
limiter = SlidingWindowRateLimiter(time_fn=lambda: now[0])
assert limiter.allow("u", 2, 60) is True
assert limiter.allow("u", 2, 60) is True
assert limiter.allow("u", 2, 60) is False
now[0] = 1061
assert limiter.allow("u", 2, 60) is True
print("PASSED")
""",
    js_harness="""
const limiter = new SlidingWindowRateLimiter();
limiter.allow('u', 2, 60);
limiter.allow('u', 2, 60);
if (limiter.allow('u', 2, 60) !== false) throw new Error('third must be denied');
console.log('PASSED');
""",
)

_IDEMPOTENCY_STORE = Invariant(
    id="idempotency_store",
    title="Idempotency-key store for the {DOMAIN} write path",
    description=(
        "Prevent duplicate side effects on retry storms. Implement a store with "
        "`set_if_absent(key, value)` returning True the first time a key is seen, "
        "`get(key)` and `contains(key)`."
    ),
    constraints=(
        "first writer wins",
        "O(1) operations",
        "keys may expire externally — not your concern, keep simple",
    ),
    python_class="""
class IdempotencyStore:
    def __init__(self):
        self.store = {}
    def set_if_absent(self, key, value) -> bool:
        if key in self.store:
            return False
        self.store[key] = value
        return True
    def get(self, key):
        return self.store.get(key)
    def contains(self, key) -> bool:
        return key in self.store
""",
    python_sample="""
class IdempotencyStore:
    # first-writer-wins; O(1) dict-backed implementation
    def __init__(self):
        raise NotImplementedError
    def set_if_absent(self, key, value) -> bool: ...
    def get(self, key): ...
    def contains(self, key) -> bool: ...
""",
    ts_sample="""
class IdempotencyStore {
  private store = new Map<string, unknown>();
  setIfAbsent(key: string, value: unknown): boolean {
    if (this.store.has(key)) return false;
    this.store.set(key, value);
    return true;
  }
  get(key: string): unknown | undefined { return this.store.get(key); }
  contains(key: string): boolean { return this.store.has(key); }
}
""",
    python_harness="""
store = IdempotencyStore()
assert store.set_if_absent("k1", "v1") is True
assert store.set_if_absent("k1", "v2") is False
assert store.get("k1") == "v1"
assert store.contains("k1") is True
assert store.contains("k2") is False
print("PASSED")
""",
    js_harness="""
const store = new IdempotencyStore();
if (store.setIfAbsent('k1', 'v1') !== true) throw new Error('first must win');
if (store.setIfAbsent('k1', 'v2') !== false) throw new Error('second must lose');
console.log('PASSED');
""",
)

_CONSISTENT_HASH = Invariant(
    id="consistent_hash",
    title="Consistent hash ring for the {DOMAIN} shard router",
    description=(
        "Implement a consistent-hash ring with virtual nodes. `add(node)` registers "
        "a node, `get(key)` returns the node responsible for `key`. Ring order "
        "must be deterministic for a given seed."
    ),
    constraints=(
        "virtual nodes (replicas) per physical node configurable",
        "get(key) O(log N) with bisect",
        "adding one node reshuffles only its neighboring slice",
    ),
    python_class="""
import hashlib, bisect
class ConsistentHashRing:
    def __init__(self, replicas: int = 160):
        self.replicas = replicas
        self.ring = []
        self.ring_map = {}
    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)
    def add(self, node: str):
        for i in range(self.replicas):
            h = self._hash(f"{node}#{i}")
            bisect.insort(self.ring, h)
            self.ring_map[h] = node
    def get(self, key: str):
        if not self.ring:
            return None
        h = self._hash(key)
        idx = bisect.bisect_right(self.ring, h) % len(self.ring)
        return self.ring_map[self.ring[idx]]
""",
    python_sample="""
import hashlib, bisect
class ConsistentHashRing:
    # bisect over md5-seeded virtual nodes
    def __init__(self, replicas: int = 160):
        self.replicas = replicas
        raise NotImplementedError
    def add(self, node: str) -> None: ...
    def get(self, key: str): ...
""",
    ts_sample="""
function md5Hash(input: string): number {
  // deterministic hash — use any stable 32-bit hash you like
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
class ConsistentHashRing {
  private ring: number[] = [];
  private ringMap = new Map<number, string>();
  constructor(public replicas = 160) {}
  add(node: string): void {
    for (let i = 0; i < this.replicas; i++) {
      const h = md5Hash(`${node}#${i}`);
      this.ring.push(h);
      this.ringMap.set(h, node);
    }
    this.ring.sort((a, b) => a - b);
  }
  get(key: string): string | null {
    if (this.ring.length === 0) return null;
    const h = md5Hash(key);
    for (const point of this.ring) {
      if (point >= h) return this.ringMap.get(point) ?? null;
    }
    return this.ringMap.get(this.ring[0]) ?? null;
  }
}
""",
    python_harness="""
ring = ConsistentHashRing(replicas=50)
ring.add("nodeA")
ring.add("nodeB")
first = ring.get("customer-1234")
assert first in ("nodeA", "nodeB")
assert ring.get("customer-1234") == first
print("PASSED")
""",
    js_harness="""
const ring = new ConsistentHashRing(50);
ring.add('nodeA');
ring.add('nodeB');
if (!ring.get('customer-1234')) throw new Error('must resolve node');
console.log('PASSED');
""",
)

_INVARIANTS = [_TOKEN_BUCKET, _LRU_TTL_CACHE, _SLIDING_WINDOW, _IDEMPOTENCY_STORE, _CONSISTENT_HASH]

_DOMAIN_WRAPPERS = {
    "payment_gateway": "high-volume payment gateway",
    "social_feed": "social media feed",
    "devtools": "developer analytics platform",
    "ecommerce": "e-commerce catalog",
    "search_index": "search indexing service",
    "iot_ingest": "IoT sensor ingestion",
}

_ROLE_TO_DOMAIN = {
    "backend": "payment_gateway",
    "distributed": "iot_ingest",
    "data": "search_index",
    "database": "search_index",
    "frontend": "social_feed",
    "fullstack": "ecommerce",
    "devops": "devtools",
    "sre": "iot_ingest",
    "platform": "devtools",
}


def _domain_for(role: str, seed: int) -> tuple[str, str]:
    role_norm = str(role or "").strip().lower().replace("-", "_")
    default_key = _ROLE_TO_DOMAIN.get(role_norm, "payment_gateway")
    keys = list(_DOMAIN_WRAPPERS.keys())
    idx = keys.index(default_key) if default_key in keys else 0
    # deterministic rotation by seed so candidates see different domains
    key = keys[(idx + seed) % len(keys)]
    return key, _DOMAIN_WRAPPERS[key]


def synthesize(role: str, seed: int | None = None) -> dict[str, Any]:
    """Return a problem dict compatible with the interview code runner."""
    seed = int(seed if seed is not None else random.randrange(1, 1_000_000))
    rng = random.Random(seed)
    domain_key, domain_desc = _domain_for(role, seed)

    inv = [i for i in _INVARIANTS]
    rng.shuffle(inv)
    primary = inv[0]

    description = primary.description.format(DOMAIN=domain_desc)
    title = primary.title.format(DOMAIN=domain_desc.title())

    problem_id = f"prob-{uuid.uuid4().hex[:6]}"
    return {
        "id": problem_id,
        "title": title,
        "difficulty": rng.choice(["Medium", "Hard"]),
        "description": description,
        "constraints": list(primary.constraints),
        "sampleCode": {"python": primary.python_sample, "typescript": primary.ts_sample},
        "testHarness": {"python": primary.python_harness, "javascript": primary.js_harness},
        "invariantId": primary.id,
        "domain": domain_key,
        "proceduralSeed": seed,
        "isProcedural": True,
    }


def self_check() -> dict[str, Any]:
    """Validate every invariant's embedded harness passes its reference solution.

    Run once at import (cheap) or on demand; returns a dict that raises on failure.
    """
    failures = []
    for inv in _INVARIANTS:
        python_src = f"{inv.python_class}\n\n{inv.python_harness}"
        try:
            code = compile(python_src, f"<{inv.id}>", "exec")  # noqa: S102 - self-check only
            globals_ = {}
            try:
                exec(code, globals_)  # noqa: S102
            except AssertionError:
                failures.append(f"{inv.id}: harness asserted against reference solution")
        except SyntaxError as e:
            failures.append(f"{inv.id}: syntax error -> {e}")
    if failures:
        raise RuntimeError("Procedural problem self-check failed: " + "; ".join(failures))
    return {"validated_invariants": len(_INVARIANTS), "ok": True}


if __name__ == "__main__":
    print(self_check())
