import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BASE_URL", "http://localhost:8788")

_passed = 0
_failed = 0


def _report(name, passed, detail=None):
    global _passed, _failed
    if passed:
        _passed += 1
        print(f"PASS  {name}")
    else:
        _failed += 1
        print(f"FAIL  {name}")
        if detail:
            print(f"      {detail}")


def _get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, {}, {}


def _post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        try:
            body_bytes = e.read()
            body_json = json.loads(body_bytes) if body_bytes else {}
        except Exception:
            body_json = {}
        return e.code, body_json, dict(e.headers)


def test_stats_valid_shape():
    status, body, _ = _get("/api/stats")
    ok = (
        status == 200
        and isinstance(body.get("connection"), int)
        and isinstance(body.get("rebel"), int)
        and isinstance(body.get("total"), int)
    )
    _report(
        "Stats returns valid shape",
        ok,
        f"status={status} body={body}",
    )


def test_vote_connection_increments():
    status, body, _ = _post("/api/vote", {"choice": "connection"})
    ok = status == 200 and body.get("success") is True and isinstance(body.get("total"), int)
    _report(
        "Vote increments counter (connection)",
        ok,
        f"status={status} body={body}",
    )


def test_vote_rebel_works():
    status, body, _ = _post("/api/vote", {"choice": "rebel"})
    ok = status == 200 and body.get("success") is True and isinstance(body.get("total"), int)
    _report(
        "Rebel vote works",
        ok,
        f"status={status} body={body}",
    )


def test_invalid_choice_rejected():
    status, body, _ = _post("/api/vote", {"choice": "invalid"})
    ok = status == 400
    _report(
        "Invalid choice rejected",
        ok,
        f"expected status=400, got status={status} body={body}",
    )


def test_missing_body_rejected():
    status, body, _ = _post("/api/vote", {})
    ok = status == 400
    _report(
        "Missing body rejected",
        ok,
        f"expected status=400, got status={status} body={body}",
    )


def test_rate_limiter_exists():
    statuses = []
    for _ in range(11):
        status, _, _ = _post("/api/vote", {"choice": "connection"})
        statuses.append(status)
    got_429 = any(s == 429 for s in statuses)
    _report(
        "Rate limiter exists",
        got_429,
        f"no 429 in {statuses}",
    )


def test_stats_cache_header():
    status, _, headers = _get("/api/stats")
    cache_control = headers.get("Cache-Control", headers.get("cache-control", ""))
    ok = status == 200 and "max-age" in cache_control
    _report(
        "Stats cache header present",
        ok,
        f"Cache-Control: {cache_control!r}",
    )


def test_cors_header_present():
    status, _, headers = _get("/api/stats")
    acao = headers.get("Access-Control-Allow-Origin", headers.get("access-control-allow-origin", ""))
    ok = status == 200 and bool(acao)
    _report(
        "CORS headers present",
        ok,
        f"Access-Control-Allow-Origin: {acao!r}",
    )


if __name__ == "__main__":
    print(f"Smoke tests against {BASE_URL}\n")
    test_stats_valid_shape()
    test_vote_connection_increments()
    test_vote_rebel_works()
    test_invalid_choice_rejected()
    test_missing_body_rejected()
    test_rate_limiter_exists()
    test_stats_cache_header()
    test_cors_header_present()
    print(f"\n{_passed + _failed} tests: {_passed} passed, {_failed} failed")
    sys.exit(0 if _failed == 0 else 1)
