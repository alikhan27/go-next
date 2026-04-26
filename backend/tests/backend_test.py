import pytest
import requests
import os

API = os.environ.get("API", "http://localhost:8000/api")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@go-next.in")
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
