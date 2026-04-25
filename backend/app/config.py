"""Static configuration constants for the Go-Next salon queue backend."""

# ---- Auth / JWT ----
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_DAYS = 7

# ---- Brute-force protection (per-email) ----
LOCKOUT_THRESHOLD = 5            # failures allowed per window
LOCKOUT_WINDOW_MINUTES = 15      # window + cool-off duration

# ---- Password reset flow (preview mode returns the link in the API
#      response instead of emailing it). ----
PASSWORD_RESET_TTL_MINUTES = 30
PASSWORD_RESET_PREVIEW_MODE = True

# ---- Account-freeze token issued after a password reset. If the real
#      owner didn't trigger the reset, the link lets them lock the account
#      until an admin restores it. ----
ACCOUNT_LOCK_TTL_MINUTES = 60 * 24

# ---- Plan gating ----
PLAN_LIMITS = {
    "free": {
        "max_outlets": 1,
        "max_stations": 3,
        "max_tokens_per_day": 50,
        "analytics_days": 14,
        "can_manage_services": False,
        "max_services": 0,
        "features": [
            "1 outlet with up to 3 stations",
            "Up to 50 tokens / day",
            "Live queue board & customer QR",
            "Live ticket tracking",
            "14-day analytics",
        ],
    },
    "premium": {
        "max_outlets": 3,
        "max_stations": 10,
        "max_tokens_per_day": 200,
        "analytics_days": 90,
        "can_manage_services": True,
        "max_services": 12,
        "features": [
            "Up to 3 outlets",
            "Up to 10 stations per outlet",
            "Up to 200 tokens / day",
            "Custom services with duration & accurate ETA",
            "Public TV \u201cNow Serving\u201d display",
            "Full 90-day analytics & heatmap",
            "Priority support",
        ],
    },
    "premium_plus": {
        "max_outlets": 25,
        "max_stations": 10,
        "max_tokens_per_day": 500,
        "analytics_days": 180,
        "can_manage_services": True,
        "max_services": 30,
        "features": [
            "Up to 25 outlets",
            "Up to 10 stations per outlet",
            "Up to 500 tokens / day",
            "Custom services with duration & accurate ETA",
            "Public TV \u201cNow Serving\u201d display",
            "180-day analytics & heatmap",
            "Dedicated success manager",
        ],
    },
}
