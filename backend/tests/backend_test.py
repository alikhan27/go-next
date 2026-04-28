import pytest
import requests
import os

API = os.environ.get("API", "http://localhost:8000/api")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "demo@go-next.in")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Demo@1234")
SUPER_EMAIL = os.environ.get("SUPER_EMAIL", "super@go-next.in")
SUPER_PASSWORD = os.environ.get("SUPER_PASSWORD", "Super@1234")

@pytest.fixture(scope="session")
def owner_session():
    s = requests.Session()
    # Clear any previous login attempts for this user to prevent 429 errors
    requests.delete(f"{API}/admin/security/lockouts/{ADMIN_EMAIL}")
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed for {ADMIN_EMAIL}: {r.status_code} {r.text}"
    data = r.json()
    yield s, data
    # Teardown: remove any TEST_* outlets we created during the session
    try:
        outlets = s.get(f"{API}/business").json()
        for o in outlets:
            if o.get("business_name", "").startswith("TEST_"):
                s.delete(f"{API}/business/{o['id']}")
    except Exception:
        pass


@pytest.fixture(scope="session")
def super_session():
    s = requests.Session()
    # Clear any previous login attempts for this user to prevent 429 errors
    requests.delete(f"{API}/admin/security/lockouts/{SUPER_EMAIL}")
    r = s.post(f"{API}/auth/login",
               json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"super login failed for {SUPER_EMAIL}: {r.status_code} {r.text}"
    data = r.json()
    yield s, data


def test_admin_user_businesses(super_session):
    s, _ = super_session

    users_resp = s.get(f"{API}/admin/users?page=1&page_size=10", timeout=15)
    assert users_resp.status_code == 200, f"Failed to load admin users: {users_resp.status_code} {users_resp.text}"
    users_data = users_resp.json()
    assert isinstance(users_data.get("items"), list), "Admin users response is missing items"

    if users_data["items"]:
        owner = users_data["items"][0]
        owner_id = owner["id"]
        businesses_resp = s.get(
            f"{API}/admin/users/{owner_id}/businesses",
            timeout=15,
        )
        assert businesses_resp.status_code == 200, (
            f"Failed to load owner businesses for {owner_id}: "
            f"{businesses_resp.status_code} {businesses_resp.text}"
        )
        payload = businesses_resp.json()
        assert isinstance(payload.get("items"), list), "Owner businesses response is missing items"
        for item in payload["items"]:
            assert item.get("owner_email") == owner.get("email", ""), "Owner email does not match"
            assert item.get("owner_name") == owner.get("name", ""), "Owner name does not match"
