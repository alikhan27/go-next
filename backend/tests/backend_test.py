"""Backend API tests for Go-Next Salon Queue API (multi-outlet iteration)."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        from pathlib import Path
        envf = Path("/app/frontend/.env").read_text()
        for line in envf.splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
    except Exception:
        pass

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@go-next.in"
ADMIN_PASSWORD = "admin123"
DEMO_ID_1 = "demo-salon"
DEMO_ID_2 = "demo-salon-andheri"


# ------------- Fixtures -------------
@pytest.fixture(scope="session")
def owner_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("access_token")
    assert "access_token" in s.cookies
    return s, data


@pytest.fixture(scope="session")
def other_owner_session():
    """A second owner for cross-owner access tests."""
    s = requests.Session()
    email = f"test_other_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email,
        "password": "password123",
        "owner_name": "Other Owner",
        "business_name": "TEST_OtherOutlet",
        "business_type": "salon",
        "address": "1 Other St",
        "city": "OtherTown",
        "state": "Karnataka",
        "pincode": "560001",
    })
    assert r.status_code == 200, r.text
    return s, r.json()


# ------------- Auth -------------
class TestAuth:
    def test_login_success_returns_user_and_businesses_list(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "owner"
        assert isinstance(data.get("businesses"), list)
        ids = [b["id"] for b in data["businesses"]]
        assert DEMO_ID_1 in ids
        assert DEMO_ID_2 in ids
        assert data.get("access_token")
        assert "access_token" in s.cookies

    def test_login_invalid_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_returns_user_and_businesses(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == ADMIN_EMAIL
        assert isinstance(data["businesses"], list)
        assert len(data["businesses"]) >= 2

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_requires_state_and_pincode(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"bad_{uuid.uuid4().hex[:6]}@example.com",
            "password": "password123",
            "owner_name": "X",
            "business_name": "Y",
        })
        assert r.status_code == 422  # missing state & pincode


# ------------- Multi-outlet business CRUD -------------
class TestBusinessCRUD:
    def test_list_outlets_includes_both_seeds(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/business")
        assert r.status_code == 200
        outlets = r.json()
        assert isinstance(outlets, list)
        ids = [o["id"] for o in outlets]
        assert DEMO_ID_1 in ids and DEMO_ID_2 in ids

    def test_create_outlet_defaults_total_chairs_to_1(self, owner_session):
        s, _ = owner_session
        name = f"TEST_Outlet_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/business", json={
            "business_name": name,
            "business_type": "salon",
            "address": "9 New St",
            "city": "NewCity",
            "state": "Maharashtra",
            "pincode": "400001",
        })
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["business_name"] == name
        assert created["total_chairs"] == 1
        # Appears in GET list
        listed = s.get(f"{API}/business").json()
        assert any(o["id"] == created["id"] for o in listed)

    def test_create_outlet_missing_state_fails(self, owner_session):
        s, _ = owner_session
        r = s.post(f"{API}/business", json={
            "business_name": "NoState",
            "business_type": "salon",
        })
        assert r.status_code == 422

    def test_patch_and_delete_outlet(self, owner_session):
        s, _ = owner_session
        name = f"TEST_Del_{uuid.uuid4().hex[:6]}"
        created = s.post(f"{API}/business", json={
            "business_name": name,
            "business_type": "salon",
            "state": "Maharashtra",
            "pincode": "400001",
        }).json()
        oid = created["id"]

        # PATCH
        r = s.patch(f"{API}/business/{oid}", json={"total_chairs": 5, "address": "New Addr"})
        assert r.status_code == 200
        assert r.json()["total_chairs"] == 5
        assert r.json()["address"] == "New Addr"

        # DELETE
        r = s.delete(f"{API}/business/{oid}")
        assert r.status_code == 200
        # GET after delete -> 404
        r = s.get(f"{API}/business/{oid}")
        assert r.status_code == 404

    def test_cross_owner_access_returns_404(self, owner_session, other_owner_session):
        _admin_s, _ = owner_session
        other_s, other_data = other_owner_session
        # Other user's outlet id
        foreign_id = other_data["businesses"][0]["id"]
        # Admin tries to read/patch foreign
        r = _admin_s.get(f"{API}/business/{foreign_id}")
        assert r.status_code == 404
        r = _admin_s.patch(f"{API}/business/{foreign_id}", json={"address": "hack"})
        assert r.status_code == 404


# ------------- Public endpoints -------------
class TestPublic:
    def test_public_business(self):
        r = requests.get(f"{API}/public/business/{DEMO_ID_1}")
        assert r.status_code == 200
        assert r.json()["id"] == DEMO_ID_1

    def test_public_business_not_found(self):
        r = requests.get(f"{API}/public/business/non-existent-id")
        assert r.status_code == 404

    def test_public_display(self):
        r = requests.get(f"{API}/public/business/{DEMO_ID_1}/display")
        assert r.status_code == 200
        data = r.json()
        for k in ("business", "serving", "upcoming", "waiting_count", "total_chairs", "updated_at"):
            assert k in data
        assert data["business"]["id"] == DEMO_ID_1
        assert isinstance(data["serving"], list)
        assert isinstance(data["upcoming"], list)
        assert len(data["upcoming"]) <= 6

    def test_public_display_no_auth_needed(self):
        # Ensure works with no cookie jar
        s = requests.Session()
        r = s.get(f"{API}/public/business/{DEMO_ID_1}/display")
        assert r.status_code == 200


# ------------- Auth gate on business endpoints -------------
class TestAuthGate:
    def test_business_endpoints_require_auth(self):
        assert requests.get(f"{API}/business").status_code == 401
        assert requests.post(f"{API}/business", json={"business_name": "x", "state": "MH", "pincode": "400001"}).status_code == 401
        assert requests.get(f"{API}/business/{DEMO_ID_1}").status_code == 401
        assert requests.get(f"{API}/business/{DEMO_ID_1}/queue").status_code == 401
        assert requests.post(f"{API}/business/{DEMO_ID_1}/queue/walk-in", json={"customer_name": "x"}).status_code == 401
        assert requests.post(f"{API}/business/{DEMO_ID_1}/queue/call-next").status_code == 401
        assert requests.get(f"{API}/business/{DEMO_ID_1}/stats").status_code == 401
        assert requests.get(f"{API}/business/{DEMO_ID_1}/analytics").status_code == 401


# ------------- Queue per-outlet -------------
class TestQueuePerOutlet:
    def test_walk_in_list_call_next_status_flow(self, owner_session):
        s, _ = owner_session
        # Free up any serving so call-next has a chair
        listed = s.get(f"{API}/business/{DEMO_ID_1}/queue").json()
        for t in listed:
            if t["status"] == "serving":
                s.patch(f"{API}/business/{DEMO_ID_1}/queue/{t['id']}/status", json={"status": "completed"})

        # Walk-in
        name = f"TEST_Walk_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/business/{DEMO_ID_1}/queue/walk-in", json={"customer_name": name, "customer_phone": "555"})
        assert r.status_code == 200, r.text
        walk = r.json()
        assert walk["booking_type"] == "walk-in"
        assert walk["status"] == "waiting"

        # List
        r = s.get(f"{API}/business/{DEMO_ID_1}/queue")
        assert r.status_code == 200
        assert any(t["id"] == walk["id"] for t in r.json())

        # Call next
        r = s.post(f"{API}/business/{DEMO_ID_1}/queue/call-next")
        assert r.status_code == 200, r.text
        served = r.json()
        assert served["status"] == "serving"
        assert served["chair_number"] is not None
        assert served["served_at"] is not None

        # Mark no_show on another waiting ticket if available
        waiting_list = s.get(f"{API}/business/{DEMO_ID_1}/queue", params={"status": "waiting"}).json()
        if waiting_list:
            wid = waiting_list[0]["id"]
            r = s.patch(f"{API}/business/{DEMO_ID_1}/queue/{wid}/status", json={"status": "no_show"})
            assert r.status_code == 200
            assert r.json()["status"] == "no_show"
            assert r.json()["finished_at"] is not None

        # Complete the currently-serving ticket
        r = s.patch(f"{API}/business/{DEMO_ID_1}/queue/{served['id']}/status", json={"status": "completed"})
        assert r.status_code == 200
        assert r.json()["status"] == "completed"
        assert r.json()["finished_at"] is not None

    def test_stats_shape(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/business/{DEMO_ID_1}/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ("waiting", "serving", "completed_today", "no_show_today"):
            assert k in data
            assert isinstance(data[k], int)


# ------------- Analytics -------------
class TestAnalytics:
    def test_analytics_after_completing_and_no_show(self, owner_session):
        s, _ = owner_session
        bid = DEMO_ID_2  # use second outlet to isolate

        # Seed: 2 completed + 1 no_show
        for i in range(2):
            w = s.post(f"{API}/business/{bid}/queue/walk-in",
                       json={"customer_name": f"TEST_A_{i}_{uuid.uuid4().hex[:4]}", "customer_phone": ""}).json()
            srv = s.post(f"{API}/business/{bid}/queue/call-next").json()
            s.patch(f"{API}/business/{bid}/queue/{srv['id']}/status", json={"status": "completed"})

        ns = s.post(f"{API}/business/{bid}/queue/walk-in",
                    json={"customer_name": f"TEST_NS_{uuid.uuid4().hex[:4]}", "customer_phone": ""}).json()
        s.patch(f"{API}/business/{bid}/queue/{ns['id']}/status", json={"status": "no_show"})

        # Fetch analytics
        r = s.get(f"{API}/business/{bid}/analytics", params={"days": 14})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["range_days"] == 14
        assert "totals" in data
        for k in ("completed", "cancelled", "no_show", "no_show_rate_pct", "avg_service_minutes"):
            assert k in data["totals"]
        assert data["totals"]["completed"] >= 2
        assert data["totals"]["no_show"] >= 1
        assert data["totals"]["no_show_rate_pct"] > 0
        # series length == days, last entry date is today
        assert isinstance(data["series"], list)
        assert len(data["series"]) == 14
        today = datetime.now(timezone.utc).date().isoformat()
        assert data["series"][-1]["date"] == today
        # heatmap: 7*24 cells
        assert isinstance(data["heatmap"], list)
        assert len(data["heatmap"]) == 7 * 24
        # At least one heatmap cell should be >0 for the completed hour
        assert sum(cell["count"] for cell in data["heatmap"]) >= 2

    def test_analytics_days_clamped(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/business/{DEMO_ID_1}/analytics", params={"days": 500})
        assert r.status_code == 200
        assert r.json()["range_days"] == 90  # clamped
