"""Backend API tests for Go-Next Salon Queue API."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to frontend/.env if not in environ
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

ADMIN_EMAIL = "admin@gonext.com"
ADMIN_PASSWORD = "admin123"
DEMO_BUSINESS_ID = "demo-salon"


# ------------- Fixtures -------------
@pytest.fixture(scope="session")
def owner_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("access_token")
    # Cookie should be set
    assert "access_token" in s.cookies
    return s, data


# ------------- Auth -------------
class TestAuth:
    def test_login_success_returns_user_business_and_sets_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "owner"
        assert data["business"]["id"] == DEMO_BUSINESS_ID
        assert data.get("access_token")
        assert "access_token" in s.cookies

    def test_login_invalid_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_cookie(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["business"]["id"] == DEMO_BUSINESS_ID

    def test_me_with_bearer_token(self, owner_session):
        _, login_data = owner_session
        token = login_data["access_token"]
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_new_owner(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email,
            "password": "password123",
            "owner_name": "Test Owner",
            "business_name": "TEST_Salon",
            "business_type": "salon",
            "address": "1 Test St",
            "city": "Testville",
            "total_chairs": 2,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email
        assert data["business"]["business_name"] == "TEST_Salon"
        assert data["business"]["total_chairs"] == 2
        assert data.get("access_token")
        assert "access_token" in s.cookies
        # auth/me with same session should work
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 200
        assert r2.json()["user"]["email"] == email

    def test_register_duplicate_email_rejected(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": ADMIN_EMAIL,
            "password": "password123",
            "owner_name": "Dup",
            "business_name": "Dup",
        })
        assert r.status_code == 400


# ------------- Public -------------
class TestPublic:
    def test_public_business(self):
        r = requests.get(f"{API}/public/business/{DEMO_BUSINESS_ID}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == DEMO_BUSINESS_ID
        assert "business_name" in data

    def test_public_business_not_found(self):
        r = requests.get(f"{API}/public/business/non-existent-id")
        assert r.status_code == 404

    def test_queue_summary(self):
        r = requests.get(f"{API}/public/business/{DEMO_BUSINESS_ID}/queue-summary")
        assert r.status_code == 200
        data = r.json()
        assert "waiting_count" in data and "serving_count" in data
        assert data["business"]["id"] == DEMO_BUSINESS_ID

    def test_join_queue_creates_ticket_and_polling_works(self):
        # create
        name = f"TEST_Cust_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/public/business/{DEMO_BUSINESS_ID}/join",
            json={"customer_name": name, "customer_phone": "1234567"},
        )
        assert r.status_code == 200
        ticket = r.json()
        assert ticket["customer_name"] == name
        assert ticket["status"] == "waiting"
        assert ticket["booking_type"] == "remote"
        assert isinstance(ticket["token_number"], int)

        # poll
        r2 = requests.get(f"{API}/public/ticket/{ticket['id']}")
        assert r2.status_code == 200
        data = r2.json()
        assert data["ticket"]["id"] == ticket["id"]
        assert "position" in data
        assert "estimated_wait_minutes" in data
        assert data["business"]["id"] == DEMO_BUSINESS_ID


# ------------- Queue management (authed) -------------
class TestQueueManage:
    def test_unauth_rejected(self):
        r = requests.get(f"{API}/queue/manage")
        assert r.status_code == 401
        r = requests.post(f"{API}/queue/manage/walk-in", json={"customer_name": "x"})
        assert r.status_code == 401
        r = requests.post(f"{API}/queue/manage/call-next")
        assert r.status_code == 401

    def test_list_queue_authed(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/queue/manage")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_walk_in_and_call_next_and_status_update(self, owner_session):
        s, _ = owner_session
        name = f"TEST_Walk_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/queue/manage/walk-in", json={"customer_name": name, "customer_phone": "555"})
        assert r.status_code == 200, r.text
        walk = r.json()
        assert walk["booking_type"] == "walk-in"
        assert walk["status"] == "waiting"
        walk_id = walk["id"]

        # ensure no overload of serving: if serving already at chairs limit, first complete any
        listed = s.get(f"{API}/queue/manage").json()
        serving = [t for t in listed if t["status"] == "serving"]
        biz = s.get(f"{API}/business/me").json()
        # free up all chairs for testing
        for t in serving:
            s.patch(f"{API}/queue/manage/{t['id']}/status", json={"status": "completed"})

        # call next -> should pick some waiting ticket and mark serving
        r = s.post(f"{API}/queue/manage/call-next")
        assert r.status_code == 200, r.text
        served = r.json()
        assert served["status"] == "serving"
        assert served["chair_number"] is not None
        assert 1 <= served["chair_number"] <= biz["total_chairs"]

        # complete it
        r = s.patch(f"{API}/queue/manage/{served['id']}/status", json={"status": "completed"})
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

        # update walk-in we added (if still waiting) to cancelled
        still = s.get(f"{API}/queue/manage", params={"status": "waiting"}).json()
        found = next((t for t in still if t["id"] == walk_id), None)
        if found:
            r = s.patch(f"{API}/queue/manage/{walk_id}/status", json={"status": "cancelled"})
            assert r.status_code == 200
            assert r.json()["status"] == "cancelled"

    def test_stats(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/queue/manage/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ("waiting", "serving", "completed_today", "cancelled_today"):
            assert k in data


# ------------- Business settings -------------
class TestBusinessSettings:
    def test_patch_business(self, owner_session):
        s, _ = owner_session
        # set a known address then revert
        r = s.patch(f"{API}/business/me", json={"address": "221 Baker Street", "city": "London"})
        assert r.status_code == 200
        data = r.json()
        assert data["address"] == "221 Baker Street"
        assert data["city"] == "London"

    def test_toggle_online(self, owner_session):
        s, _ = owner_session
        r = s.patch(f"{API}/business/me", json={"is_online": False})
        assert r.status_code == 200
        assert r.json()["is_online"] is False
        # now offline, public join should 400
        rj = requests.post(
            f"{API}/public/business/{DEMO_BUSINESS_ID}/join",
            json={"customer_name": "TEST_Offline", "customer_phone": "1234567"},
        )
        assert rj.status_code == 400
        # restore
        r = s.patch(f"{API}/business/me", json={"is_online": True})
        assert r.status_code == 200
        assert r.json()["is_online"] is True
