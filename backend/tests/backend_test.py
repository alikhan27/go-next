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
    # Premium plan now caps at 3 outlets; admin is seeded with 2 demo-* outlets.
    # Purge any leftover TEST_* outlets from prior runs so create-outlet tests have headroom.
    try:
        outlets = s.get(f"{API}/business").json()
        for o in outlets:
            if o.get("business_name", "").startswith("TEST_") or o.get("id", "").startswith("test_"):
                s.delete(f"{API}/business/{o['id']}")
    except Exception:
        pass
    yield s, data
    # Teardown: remove any TEST_* outlets we created during the session
    try:
        outlets = s.get(f"{API}/business").json()
        for o in outlets:
            if o.get("business_name", "").startswith("TEST_"):
                s.delete(f"{API}/business/{o['id']}")
    except Exception:
        pass


def _owner_session_unused():
    return None


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
        # cleanup so we don't deplete the 3-outlet premium quota for subsequent tests
        s.delete(f"{API}/business/{created['id']}")

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
                       json={"customer_name": f"TEST_A_{i}_{uuid.uuid4().hex[:4]}", "customer_phone": "9990005678"}).json()
            srv = s.post(f"{API}/business/{bid}/queue/call-next").json()
            s.patch(f"{API}/business/{bid}/queue/{srv['id']}/status", json={"status": "completed"})

        ns = s.post(f"{API}/business/{bid}/queue/walk-in",
                    json={"customer_name": f"TEST_NS_{uuid.uuid4().hex[:4]}", "customer_phone": "9990005678"}).json()
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



# ------------- Plans (public) -------------
class TestPlans:
    def test_plans_endpoint(self):
        r = requests.get(f"{API}/plans")
        assert r.status_code == 200
        data = r.json()
        assert "plans" in data
        ids = {p["id"]: p for p in data["plans"]}
        assert "free" in ids and "premium" in ids and "premium_plus" in ids
        free = ids["free"]
        assert free["max_outlets"] == 1
        assert free["max_stations"] == 3
        assert free["max_tokens_per_day"] == 50
        assert free["analytics_days"] == 14
        assert free.get("can_manage_services") is False
        assert free.get("max_services") == 0
        prem = ids["premium"]
        assert prem["max_outlets"] == 3
        assert prem["max_stations"] == 10
        assert prem["max_tokens_per_day"] == 200
        assert prem["analytics_days"] == 90
        assert prem.get("can_manage_services") is True
        assert prem.get("max_services") == 12
        plus = ids["premium_plus"]
        assert plus["max_outlets"] == 25
        assert plus["max_stations"] == 10
        assert plus["max_tokens_per_day"] == 500
        assert plus.get("can_manage_services") is True
        assert plus.get("max_services") == 30


# ------------- Free-plan enforcement -------------
SUPER_EMAIL = "super@go-next.in"
SUPER_PASSWORD = "admin123"


@pytest.fixture
def fresh_free_owner():
    """Register a brand-new free owner; returns (session, data, email)."""
    s = requests.Session()
    email = f"test_free_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "password123",
        "owner_name": "Free Owner", "business_name": "TEST_FreeOutlet",
        "business_type": "salon", "state": "Maharashtra", "pincode": "400001",
    }, timeout=15)
    assert r.status_code == 200, r.text
    return s, r.json(), email


@pytest.fixture(scope="session")
def super_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"super login failed: {r.status_code} {r.text}"
    return s, r.json()


class TestFreePlanLimits:
    def test_register_defaults_to_free_plan(self, fresh_free_owner):
        s, data, _ = fresh_free_owner
        assert data["user"]["plan"] == "free"
        assert data["user"]["role"] == "owner"
        # me reflects plan/role
        me = s.get(f"{API}/auth/me").json()
        assert me["user"]["plan"] == "free"
        assert me["user"]["role"] == "owner"
        # Created outlet's token_limit clamped to 50
        assert data["businesses"][0]["token_limit"] == 50

    def test_free_cannot_create_second_outlet(self, fresh_free_owner):
        s, _, _ = fresh_free_owner
        r = s.post(f"{API}/business", json={
            "business_name": "TEST_Second",
            "business_type": "salon",
            "state": "Maharashtra", "pincode": "400001",
        })
        assert r.status_code == 403, r.text
        detail = r.json().get("detail", "")
        assert "Free" in detail or "outlet" in detail.lower()

    def test_free_cannot_patch_chairs_above_limit(self, fresh_free_owner):
        s, data, _ = fresh_free_owner
        bid = data["businesses"][0]["id"]
        # Free plan max_stations is now 3
        r = s.patch(f"{API}/business/{bid}", json={"total_chairs": 4})
        assert r.status_code == 403
        # Equal-to-limit should pass
        r = s.patch(f"{API}/business/{bid}", json={"total_chairs": 3})
        assert r.status_code == 200

    def test_free_cannot_patch_token_limit_above_50(self, fresh_free_owner):
        s, data, _ = fresh_free_owner
        bid = data["businesses"][0]["id"]
        r = s.patch(f"{API}/business/{bid}", json={"token_limit": 100})
        assert r.status_code == 403
        r = s.patch(f"{API}/business/{bid}", json={"token_limit": 50})
        assert r.status_code == 200

    def test_premium_admin_has_multiple_outlets(self, owner_session):
        s, data = owner_session
        assert data["user"]["plan"] == "premium"
        ids = [b["id"] for b in data["businesses"]]
        assert DEMO_ID_1 in ids and DEMO_ID_2 in ids


# ------------- Super Admin -------------
class TestSuperAdminAuthGate:
    def test_admin_endpoints_unauth(self):
        for ep in ("/admin/stats", "/admin/users", "/admin/businesses"):
            assert requests.get(f"{API}{ep}").status_code == 401

    def test_admin_endpoints_forbidden_for_owner(self, owner_session):
        s, _ = owner_session
        for ep in ("/admin/stats", "/admin/users", "/admin/businesses"):
            r = s.get(f"{API}{ep}")
            assert r.status_code == 403, f"{ep} expected 403, got {r.status_code}"


class TestSuperAdminFlows:
    def test_super_login_returns_role(self, super_session):
        _s, data = super_session
        assert data["user"]["role"] == "super_admin"
        assert data["user"]["email"] == SUPER_EMAIL

    def test_admin_stats_shape(self, super_session):
        s, _ = super_session
        r = s.get(f"{API}/admin/stats")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("total_users", "free_users", "premium_users",
                  "total_businesses", "total_tickets", "completed_today"):
            assert k in data
            assert isinstance(data[k], int)
        # premium users must include the seeded admin
        assert data["premium_users"] >= 1
        assert data["total_users"] >= 1

    def test_admin_users_list_has_outlet_count(self, super_session):
        s, _ = super_session
        r = s.get(f"{API}/admin/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        emails = {u["email"]: u for u in users}
        assert ADMIN_EMAIL in emails
        admin_entry = emails[ADMIN_EMAIL]
        assert admin_entry["plan"] == "premium"
        assert admin_entry["outlet_count"] >= 2
        # super admin should NOT appear (role filter = owner)
        assert SUPER_EMAIL not in emails

    def test_admin_businesses_has_owner_email(self, super_session):
        s, _ = super_session
        r = s.get(f"{API}/admin/businesses")
        assert r.status_code == 200
        outlets = r.json()
        assert isinstance(outlets, list)
        ids = {o["id"]: o for o in outlets}
        assert DEMO_ID_1 in ids
        demo = ids[DEMO_ID_1]
        assert demo["owner_email"] == ADMIN_EMAIL
        assert demo["owner_plan"] == "premium"
        assert "owner_name" in demo

    def test_upgrade_free_to_premium_unlocks_second_outlet(self, super_session, fresh_free_owner):
        sup_s, _ = super_session
        own_s, own_data, _email = fresh_free_owner
        uid = own_data["user"]["id"]

        # Pre-upgrade: second outlet must 403
        r = own_s.post(f"{API}/business", json={
            "business_name": "TEST_SecondPre", "state": "Maharashtra", "pincode": "400001",
        })
        assert r.status_code == 403

        # Upgrade via admin
        r = sup_s.patch(f"{API}/admin/users/{uid}", json={"plan": "premium"})
        assert r.status_code == 200, r.text
        assert r.json()["plan"] == "premium"

        # /auth/me now reports premium
        me = own_s.get(f"{API}/auth/me").json()
        assert me["user"]["plan"] == "premium"

        # Now second outlet creation succeeds
        r = own_s.post(f"{API}/business", json={
            "business_name": "TEST_SecondPost", "state": "Maharashtra", "pincode": "400001",
        })
        assert r.status_code == 200, r.text

    def test_admin_delete_outlet_and_tickets(self, super_session, owner_session):
        sup_s, _ = super_session
        own_s, _ = owner_session
        # Create a temp outlet under the premium admin owner
        created = own_s.post(f"{API}/business", json={
            "business_name": f"TEST_AdminDel_{uuid.uuid4().hex[:6]}",
            "state": "Maharashtra", "pincode": "400001",
        }).json()
        oid = created["id"]
        # Add a walk-in ticket so we can verify cascade delete
        own_s.post(f"{API}/business/{oid}/queue/walk-in",
                   json={"customer_name": "TEST_CascadeDel", "customer_phone": "9990005678"})

        # super admin deletes
        r = sup_s.delete(f"{API}/admin/businesses/{oid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Outlet gone
        r = own_s.get(f"{API}/business/{oid}")
        assert r.status_code == 404
        # Delete again -> 404
        r = sup_s.delete(f"{API}/admin/businesses/{oid}")
        assert r.status_code == 404


# ------------- Brute-force lockout (5 failures / 15-min) -------------
class TestBruteForceLockout:
    def test_lockout_after_5_failed_attempts(self):
        """After 5 failed attempts, the 6th (even with correct pwd) returns 429."""
        # Create fresh user so we don't lock out the session admin
        s = requests.Session()
        email = f"test_brute_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register", json={
            "email": email, "password": "password123",
            "owner_name": "Brute Owner", "business_name": "TEST_BruteOutlet",
            "business_type": "salon", "state": "Maharashtra", "pincode": "400001",
        })
        assert reg.status_code == 200, reg.text

        # 5 wrong attempts → all 401
        for i in range(5):
            r = requests.post(f"{API}/auth/login",
                              json={"email": email, "password": "wrongpw"})
            assert r.status_code == 401, f"attempt {i+1}: {r.status_code} {r.text}"

        # 6th — even the CORRECT password should be blocked
        r = requests.post(f"{API}/auth/login",
                          json={"email": email, "password": "password123"})
        assert r.status_code == 429, f"expected 429 got {r.status_code}: {r.text}"
        assert "Too many failed attempts" in r.json().get("detail", "")

        # Super admin clears the lockout
        sup = requests.Session()
        sup.post(f"{API}/auth/login",
                 json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD})
        clr = sup.delete(f"{API}/admin/security/lockouts/{email}")
        assert clr.status_code == 200
        assert clr.json()["ok"] is True

        # Correct login now succeeds
        r = requests.post(f"{API}/auth/login",
                          json={"email": email, "password": "password123"})
        assert r.status_code == 200, r.text


# ------------- Forgot/Reset/Lock password flow (preview mode) -------------
class TestPasswordResetFlow:
    def test_forgot_returns_preview_link_and_reset_succeeds(self):
        # Fresh user so we can freely reset
        s = requests.Session()
        email = f"test_reset_{uuid.uuid4().hex[:8]}@example.com"
        original_pw = "password123"
        new_pw = "newpassword456"
        reg = s.post(f"{API}/auth/register", json={
            "email": email, "password": original_pw,
            "owner_name": "Reset Owner", "business_name": "TEST_ResetOutlet",
            "business_type": "salon", "state": "Maharashtra", "pincode": "400001",
        })
        assert reg.status_code == 200

        # forgot-password
        fp = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert fp.status_code == 200, fp.text
        fp_data = fp.json()
        assert fp_data["ok"] is True
        assert "preview_reset_link" in fp_data, f"missing preview_reset_link: {fp_data}"
        link = fp_data["preview_reset_link"]
        token = link.split("token=")[-1]
        assert token

        # reset-password
        rp = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "new_password": new_pw})
        assert rp.status_code == 200, rp.text
        rp_data = rp.json()
        assert rp_data["ok"] is True
        assert "preview_lock_link" in rp_data, f"missing preview_lock_link: {rp_data}"
        lock_token = rp_data["preview_lock_link"].split("token=")[-1]

        # Reusing the same reset token -> 400
        reused = requests.post(f"{API}/auth/reset-password",
                               json={"token": token, "new_password": "another"})
        assert reused.status_code == 400

        # Old password no longer works; new one works
        bad = requests.post(f"{API}/auth/login",
                            json={"email": email, "password": original_pw})
        assert bad.status_code == 401
        good = requests.post(f"{API}/auth/login",
                             json={"email": email, "password": new_pw})
        assert good.status_code == 200

        # lock-account freezes the account
        la = requests.post(f"{API}/auth/lock-account", json={"token": lock_token})
        assert la.status_code == 200, la.text
        assert la.json()["ok"] is True

        # Now login with correct password returns 403 (frozen)
        r = requests.post(f"{API}/auth/login",
                          json={"email": email, "password": new_pw})
        assert r.status_code == 403
        assert "frozen" in r.json().get("detail", "").lower()

        # Reusing the lock token -> 400
        r2 = requests.post(f"{API}/auth/lock-account", json={"token": lock_token})
        assert r2.status_code == 400

    def test_forgot_unknown_email_still_ok(self):
        # Must not leak existence
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"ghost_{uuid.uuid4().hex[:6]}@nowhere.io"})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert "preview_reset_link" not in r.json()

    def test_reset_with_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": "not-a-real-token", "new_password": "whatever123"})
        assert r.status_code == 400


# ------------- Admin security / lockouts -------------
class TestAdminLockouts:
    def test_lockouts_endpoint_lists_trapped_email(self, super_session):
        sup_s, _ = super_session
        # Seed a fresh locked email
        email = f"test_lockadmin_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        s.post(f"{API}/auth/register", json={
            "email": email, "password": "password123",
            "owner_name": "Lock Admin", "business_name": "TEST_LockAdminOutlet",
            "business_type": "salon", "state": "Maharashtra", "pincode": "400001",
        })
        for _ in range(5):
            requests.post(f"{API}/auth/login",
                          json={"email": email, "password": "wrong"})

        r = sup_s.get(f"{API}/admin/security/lockouts")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        match = [row for row in rows if row["email"] == email]
        assert len(match) == 1, f"expected lockout row for {email}: {rows}"
        row = match[0]
        assert row["failed_attempts"] >= 5
        assert row["is_locked"] is True
        assert row["unlock_at"]

        # clear
        clr = sup_s.delete(f"{API}/admin/security/lockouts/{email}")
        assert clr.status_code == 200
        assert clr.json()["cleared"] >= 5

        # cleared from list
        r2 = sup_s.get(f"{API}/admin/security/lockouts")
        assert not any(row["email"] == email for row in r2.json())

    def test_lockouts_endpoints_forbidden_for_owner(self, owner_session):
        s, _ = owner_session
        r = s.get(f"{API}/admin/security/lockouts")
        assert r.status_code == 403
        r = s.delete(f"{API}/admin/security/lockouts/any@x.io")
        assert r.status_code == 403

    def test_lockouts_endpoints_unauth(self):
        assert requests.get(f"{API}/admin/security/lockouts").status_code == 401
        assert requests.delete(f"{API}/admin/security/lockouts/x@y.io").status_code == 401


# ------------- Public queue endpoints (added in refactor) -------------
class TestPublicQueueAndJoin:
    def test_queue_summary_shape(self):
        r = requests.get(f"{API}/public/business/{DEMO_ID_1}/queue-summary")
        assert r.status_code == 200
        data = r.json()
        for k in ("waiting_count", "serving_count", "total_chairs", "business"):
            assert k in data, f"missing key '{k}' in {data}"
        assert isinstance(data["waiting_count"], int)
        assert data["business"]["id"] == DEMO_ID_1

    def test_join_creates_ticket_and_public_ticket_lookup(self):
        # Use DEMO_ID_2 (Andheri) which is seeded without services so join works
        # without service_id (backward-compat path).
        body = {"customer_name": f"TEST_PubJoin_{uuid.uuid4().hex[:4]}",
                "customer_phone": "9990001111", "party_size": 1}
        r = requests.post(f"{API}/public/business/{DEMO_ID_2}/join", json=body)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["business_id"] == DEMO_ID_2
        assert t["status"] == "waiting"
        tid = t["id"]
        # public ticket lookup — wrapped in {ticket, position, estimated_wait_minutes, business}
        r2 = requests.get(f"{API}/public/ticket/{tid}")
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "ticket" in data and "position" in data and "business" in data
        assert data["ticket"]["id"] == tid
        assert data["business"]["id"] == DEMO_ID_2
        assert isinstance(data["position"], int)




# ------------- Services CRUD (premium+) and public services -------------
class TestServicesCRUD:
    def _make_temp_outlet(self, s):
        created = s.post(f"{API}/business", json={
            "business_name": f"TEST_Svc_{uuid.uuid4().hex[:6]}",
            "business_type": "salon",
            "state": "Maharashtra", "pincode": "400001",
        }).json()
        return created["id"]

    def test_premium_owner_full_crud(self, owner_session):
        s, _ = owner_session
        bid = self._make_temp_outlet(s)
        # initially empty
        r = s.get(f"{API}/business/{bid}/services")
        assert r.status_code == 200
        assert r.json() == []

        # create
        r = s.post(f"{API}/business/{bid}/services",
                   json={"name": "Haircut", "duration_minutes": 30})
        assert r.status_code == 200, r.text
        svc = r.json()
        for k in ("id", "business_id", "name", "duration_minutes", "sort_order", "is_active", "created_at"):
            assert k in svc, f"missing {k} in {svc}"
        assert svc["business_id"] == bid
        assert svc["name"] == "Haircut"
        assert svc["duration_minutes"] == 30
        assert svc["is_active"] is True
        sid = svc["id"]

        # patch name + duration + sort_order
        r = s.patch(f"{API}/business/{bid}/services/{sid}",
                    json={"name": "Premium Haircut", "duration_minutes": 45, "sort_order": 5})
        assert r.status_code == 200
        upd = r.json()
        assert upd["name"] == "Premium Haircut"
        assert upd["duration_minutes"] == 45
        assert upd["sort_order"] == 5

        # toggle inactive
        r = s.patch(f"{API}/business/{bid}/services/{sid}", json={"is_active": False})
        assert r.status_code == 200
        assert r.json()["is_active"] is False

        # public list excludes inactive
        r = requests.get(f"{API}/public/business/{bid}/services")
        assert r.status_code == 200
        assert all(svc["id"] != sid for svc in r.json())

        # re-activate so it appears in public
        s.patch(f"{API}/business/{bid}/services/{sid}", json={"is_active": True})
        r = requests.get(f"{API}/public/business/{bid}/services")
        assert any(it["id"] == sid for it in r.json())

        # delete
        r = s.delete(f"{API}/business/{bid}/services/{sid}")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # subsequent delete -> 404
        r = s.delete(f"{API}/business/{bid}/services/{sid}")
        assert r.status_code == 404

        # cleanup outlet
        s.delete(f"{API}/business/{bid}")

    def test_premium_max_services_cap_12(self, owner_session):
        s, _ = owner_session
        bid = self._make_temp_outlet(s)
        for i in range(12):
            r = s.post(f"{API}/business/{bid}/services",
                       json={"name": f"Svc {i}", "duration_minutes": 10})
            assert r.status_code == 200, f"create #{i}: {r.text}"
        # 13th must fail
        r = s.post(f"{API}/business/{bid}/services",
                   json={"name": "Svc 13", "duration_minutes": 10})
        assert r.status_code == 403
        s.delete(f"{API}/business/{bid}")

    def test_free_owner_cannot_manage_services(self, fresh_free_owner):
        s, data, _ = fresh_free_owner
        bid = data["businesses"][0]["id"]
        # GET still works (empty list)
        r = s.get(f"{API}/business/{bid}/services")
        assert r.status_code == 200
        assert r.json() == []
        # POST blocked
        r = s.post(f"{API}/business/{bid}/services",
                   json={"name": "Trial", "duration_minutes": 15})
        assert r.status_code == 403
        assert "Premium" in r.json().get("detail", "")
        # PATCH/DELETE on non-existent are still gated by paid plan
        r = s.patch(f"{API}/business/{bid}/services/anything", json={"name": "x"})
        assert r.status_code == 403
        r = s.delete(f"{API}/business/{bid}/services/anything")
        assert r.status_code == 403

    def test_public_services_empty_for_outlet_without(self):
        # demo-salon-andheri has no services seeded
        r = requests.get(f"{API}/public/business/{DEMO_ID_2}/services")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------- Public Join with service_id validation -------------
class TestJoinWithService:
    def test_join_requires_service_when_outlet_has_active(self, owner_session):
        s, _ = owner_session
        # create a fresh outlet so we control service state cleanly
        bid = s.post(f"{API}/business", json={
            "business_name": f"TEST_JoinSvc_{uuid.uuid4().hex[:5]}",
            "business_type": "salon",
            "state": "Maharashtra", "pincode": "400001",
        }).json()["id"]
        svc = s.post(f"{API}/business/{bid}/services",
                     json={"name": "Beard Trim", "duration_minutes": 20}).json()
        sid = svc["id"]

        # join without service_id -> 400
        r = requests.post(f"{API}/public/business/{bid}/join",
                          json={"customer_name": "TEST_NoSvc", "customer_phone": "9990001234"})
        assert r.status_code == 400
        assert "service" in r.json().get("detail", "").lower()

        # join with service_id from another outlet -> 400
        r = requests.post(f"{API}/public/business/{bid}/join",
                          json={"customer_name": "TEST_Bad", "customer_phone": "9990001234",
                                "service_id": "non-existent-id"})
        assert r.status_code == 400
        assert "unavailable" in r.json().get("detail", "").lower()

        # valid service_id -> 200, denormalised fields present
        r = requests.post(f"{API}/public/business/{bid}/join",
                          json={"customer_name": "TEST_Good", "customer_phone": "9990001234",
                                "service_id": sid})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["service_id"] == sid
        assert t["service_name"] == "Beard Trim"
        assert t["service_duration_minutes"] == 20

        # deactivate service -> using sid should now 400
        s.patch(f"{API}/business/{bid}/services/{sid}", json={"is_active": False})
        r = requests.post(f"{API}/public/business/{bid}/join",
                          json={"customer_name": "TEST_Inactive", "customer_phone": "9990001234",
                                "service_id": sid})
        assert r.status_code == 400

        # cleanup
        s.delete(f"{API}/business/{bid}")

    def test_join_no_service_required_when_outlet_has_none(self):
        # demo-salon-andheri has no services seeded
        r = requests.post(f"{API}/public/business/{DEMO_ID_2}/join",
                          json={"customer_name": f"TEST_BWC_{uuid.uuid4().hex[:4]}",
                                "customer_phone": "9990005678"})
        assert r.status_code == 200, r.text


# ------------- ETA calculation -------------
class TestETACalculation:
    def test_queue_summary_includes_estimated_wait_minutes(self):
        r = requests.get(f"{API}/public/business/{DEMO_ID_1}/queue-summary")
        assert r.status_code == 200
        data = r.json()
        assert "estimated_wait_minutes" in data
        assert isinstance(data["estimated_wait_minutes"], int)

    def test_eta_uses_service_duration_in_ticket(self, owner_session):
        s, _ = owner_session
        bid = s.post(f"{API}/business", json={
            "business_name": f"TEST_ETA_{uuid.uuid4().hex[:5]}",
            "business_type": "salon",
            "state": "Maharashtra", "pincode": "400001",
        }).json()["id"]
        # set chairs=1 so wait = duration ahead
        s.patch(f"{API}/business/{bid}", json={"total_chairs": 1})
        sid = s.post(f"{API}/business/{bid}/services",
                     json={"name": "Long Service", "duration_minutes": 40}).json()["id"]

        # First joiner — alone, chairs available -> ETA 0
        r1 = requests.post(f"{API}/public/business/{bid}/join",
                           json={"customer_name": "TEST_E1", "customer_phone": "9990001234",
                                 "service_id": sid})
        assert r1.status_code == 200
        t1 = r1.json()
        tk1 = requests.get(f"{API}/public/ticket/{t1['id']}").json()
        assert tk1["estimated_wait_minutes"] == 0

        # Second joiner — one ticket ahead (40 min) / 1 chair = 40
        r2 = requests.post(f"{API}/public/business/{bid}/join",
                           json={"customer_name": "TEST_E2", "customer_phone": "9990001234",
                                 "service_id": sid})
        assert r2.status_code == 200
        t2 = r2.json()
        tk2 = requests.get(f"{API}/public/ticket/{t2['id']}").json()
        assert tk2["position"] == 2
        assert tk2["estimated_wait_minutes"] == 40

        # queue-summary now should be sum(40+40)/1 = 80
        qs = requests.get(f"{API}/public/business/{bid}/queue-summary").json()
        assert qs["estimated_wait_minutes"] == 80

        # cleanup
        s.delete(f"{API}/business/{bid}")


# ------------- Walk-in with service_id -------------
class TestWalkInWithService:
    def test_walk_in_with_service_attaches_fields(self, owner_session):
        s, _ = owner_session
        bid = s.post(f"{API}/business", json={
            "business_name": f"TEST_WalkSvc_{uuid.uuid4().hex[:5]}",
            "business_type": "salon",
            "state": "Maharashtra", "pincode": "400001",
        }).json()["id"]
        sid = s.post(f"{API}/business/{bid}/services",
                     json={"name": "Spa", "duration_minutes": 25}).json()["id"]

        r = s.post(f"{API}/business/{bid}/queue/walk-in",
                   json={"customer_name": "TEST_WalkSvc", "customer_phone": "9990005678",
                         "service_id": sid})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["service_id"] == sid
        assert t["service_name"] == "Spa"
        assert t["service_duration_minutes"] == 25
        s.delete(f"{API}/business/{bid}")


# ------------- Admin user plan update accepts premium_plus -------------
class TestAdminPlanUpdate:
    def test_super_admin_can_set_premium_plus(self, super_session, fresh_free_owner):
        sup_s, _ = super_session
        own_s, own_data, _ = fresh_free_owner
        uid = own_data["user"]["id"]

        r = sup_s.patch(f"{API}/admin/users/{uid}", json={"plan": "premium_plus"})
        assert r.status_code == 200, r.text
        assert r.json()["plan"] == "premium_plus"

        me = own_s.get(f"{API}/auth/me").json()
        assert me["user"]["plan"] == "premium_plus"

        # premium_plus owner can create up to 25 outlets (we just create a couple)
        r = own_s.post(f"{API}/business", json={
            "business_name": "TEST_PP_Outlet1",
            "state": "Maharashtra", "pincode": "400001",
        })
        assert r.status_code == 200
        # premium_plus chairs cap = 10; 11 must 403
        bid = r.json()["id"]
        r = own_s.patch(f"{API}/business/{bid}", json={"total_chairs": 11})
        assert r.status_code == 403
        r = own_s.patch(f"{API}/business/{bid}", json={"total_chairs": 10})
        assert r.status_code == 200
        # tokens cap = 500
        r = own_s.patch(f"{API}/business/{bid}", json={"token_limit": 600})
        assert r.status_code == 403
        r = own_s.patch(f"{API}/business/{bid}", json={"token_limit": 500})
        assert r.status_code == 200

    def test_invalid_plan_rejected(self, super_session, owner_session):
        sup_s, _ = super_session
        # Use the seeded admin user id
        users = sup_s.get(f"{API}/admin/users").json()
        admin_user = next(u for u in users if u["email"] == ADMIN_EMAIL)
        r = sup_s.patch(f"{API}/admin/users/{admin_user['id']}",
                        json={"plan": "platinum"})
        assert r.status_code in (400, 422)


# ------------- Premium chairs/tokens caps -------------
class TestPremiumLimits:
    def test_premium_cannot_exceed_10_chairs_or_200_tokens(self, owner_session):
        s, _ = owner_session
        bid = s.post(f"{API}/business", json={
            "business_name": f"TEST_PremCaps_{uuid.uuid4().hex[:5]}",
            "state": "Maharashtra", "pincode": "400001",
        }).json()["id"]
        # 11 chairs -> 403
        r = s.patch(f"{API}/business/{bid}", json={"total_chairs": 11})
        assert r.status_code == 403
        r = s.patch(f"{API}/business/{bid}", json={"total_chairs": 10})
        assert r.status_code == 200
        # tokens 201 -> 403
        r = s.patch(f"{API}/business/{bid}", json={"token_limit": 201})
        assert r.status_code == 403
        r = s.patch(f"{API}/business/{bid}", json={"token_limit": 200})
        assert r.status_code == 200
        s.delete(f"{API}/business/{bid}")

    def test_premium_max_3_outlets(self):
        # register fresh, upgrade to premium, then try to create 3 more (already has 1)
        s = requests.Session()
        email = f"test_p3_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register", json={
            "email": email, "password": "password123",
            "owner_name": "P3", "business_name": "TEST_P3_1",
            "business_type": "salon", "state": "Maharashtra", "pincode": "400001",
        })
        assert reg.status_code == 200
        uid = reg.json()["user"]["id"]
        sup = requests.Session()
        sup.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD})
        sup.patch(f"{API}/admin/users/{uid}", json={"plan": "premium"})

        # 2 more -> ok (total 3)
        for i in range(2):
            r = s.post(f"{API}/business", json={
                "business_name": f"TEST_P3_{i+2}",
                "state": "Maharashtra", "pincode": "400001",
            })
            assert r.status_code == 200, r.text
        # 4th -> 403
        r = s.post(f"{API}/business", json={
            "business_name": "TEST_P3_4",
            "state": "Maharashtra", "pincode": "400001",
        })
        assert r.status_code == 403
