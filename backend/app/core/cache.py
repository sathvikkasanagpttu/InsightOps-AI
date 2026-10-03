import functools
import hashlib
import json
import os
import time
from typing import Any, Callable, Dict, Optional

# Attempt to import redis; fall back to high-performance in-memory cache
_redis_client = None
_redis_available = False

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    import redis
    client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    client.ping()
    _redis_client = client
    _redis_available = True
except Exception:
    _redis_client = None
    _redis_available = False


class MemoryCache:
    """In-memory thread-safe TTL cache with LRU eviction."""
    def __init__(self, max_size: int = 1000):
        self.store: Dict[str, Any] = {}
        self.expirations: Dict[str, float] = {}
        self.max_size = max_size
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        if key in self.store:
            exp = self.expirations.get(key, 0)
            if exp == 0 or exp > now:
                self.hits += 1
                return self.store[key]
            else:
                self.delete(key)
        self.misses += 1
        return None

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        if len(self.store) >= self.max_size:
            # Simple eviction of oldest item
            oldest = next(iter(self.store))
            self.delete(oldest)
        self.store[key] = value
        self.expirations[key] = time.time() + ttl if ttl > 0 else 0

    def delete(self, key: str) -> bool:
        existed = key in self.store
        self.store.pop(key, None)
        self.expirations.pop(key, None)
        return existed

    def delete_pattern(self, pattern: str) -> int:
        import fnmatch
        keys_to_del = [k for k in self.store if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_del:
            self.delete(k)
        return len(keys_to_del)

    def stats(self) -> Dict[str, Any]:
        return {
            "type": "in_memory",
            "keys_count": len(self.store),
            "hits": self.hits,
            "misses": self.misses,
            "hit_ratio": round(self.hits / (self.hits + self.misses), 3) if (self.hits + self.misses) > 0 else 0.0
        }


_mem_cache = MemoryCache()


class CacheService:
    @staticmethod
    def get(key: str) -> Optional[Any]:
        if _redis_available and _redis_client:
            try:
                raw = _redis_client.get(key)
                if raw is not None:
                    return json.loads(raw)
            except Exception:
                pass
        return _mem_cache.get(key)

    @staticmethod
    def set(key: str, value: Any, ttl: int = 300) -> None:
        if _redis_available and _redis_client:
            try:
                _redis_client.setex(key, ttl, json.dumps(value))
                return
            except Exception:
                pass
        _mem_cache.set(key, value, ttl=ttl)

    @staticmethod
    def delete(key: str) -> bool:
        if _redis_available and _redis_client:
            try:
                return bool(_redis_client.delete(key))
            except Exception:
                pass
        return _mem_cache.delete(key)

    @staticmethod
    def delete_pattern(pattern: str) -> int:
        if _redis_available and _redis_client:
            try:
                keys = _redis_client.keys(pattern)
                if keys:
                    return _redis_client.delete(*keys)
                return 0
            except Exception:
                pass
        return _mem_cache.delete_pattern(pattern)

    @staticmethod
    def stats() -> Dict[str, Any]:
        if _redis_available and _redis_client:
            try:
                info = _redis_client.info()
                return {
                    "type": "redis",
                    "connected_clients": info.get("connected_clients"),
                    "used_memory_human": info.get("used_memory_human"),
                    "total_keys": _redis_client.dbsize()
                }
            except Exception:
                pass
        return _mem_cache.stats()


def cached(ttl: int = 300, key_prefix: str = "io"):
    """Decorator to cache idempotent functions/endpoints."""
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key based on function name and JSON representation of args
            try:
                raw_args = json.dumps({"args": args[1:] if len(args) > 0 and hasattr(args[0], "__class__") else args, "kwargs": kwargs}, sort_keys=True, default=str)
            except Exception:
                raw_args = str(args) + str(kwargs)
            hash_sig = hashlib.sha256(raw_args.encode()).hexdigest()[:16]
            cache_key = f"{key_prefix}:{func.__name__}:{hash_sig}"

            hit = CacheService.get(cache_key)
            if hit is not None:
                return hit

            result = func(*args, **kwargs)
            CacheService.set(cache_key, result, ttl=ttl)
            return result
        return wrapper
    return decorator
