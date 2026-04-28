// Single source of truth for the "What's new" feed inside the app.
// When adding a new release, bump LATEST_VERSION and prepend an entry.

export const LATEST_VERSION = "v2.7";

export const RELEASES = [
  {
    version: "v2.7",
    date: "Feb 2026",
    title: "Admin tables now search, sort and paginate",
    tag: "Update",
    highlights: [
      {
        heading: "Instant search",
        body: "Every admin table (Owners, Outlets, Security) has a search box that filters by the fields that make sense \u2014 email, name, plan, business name, owner, city, state or pincode.",
      },
      {
        heading: "Click-to-sort columns",
        body: "Tap any column header to sort ascending, again for descending, once more to clear. Sort arrows make the current order obvious at a glance.",
      },
      {
        heading: "Page sizes + prev / next",
        body: "Pick 10, 25, 50 or 100 rows per page. Pagination controls stay at the bottom so the table header is always reachable.",
      },
      {
        heading: "Live row count",
        body: "The \u201cN rows\u201d counter reflects the filtered total so you always know what you\u2019re looking at.",
      },
    ],
  },
  {
    version: "v2.6",
    date: "Feb 2026",
    title: "\u201cWasn\u2019t you?\u201d \u2014 one-click account lock",
    tag: "Security",
    highlights: [
      {
        heading: "Second link after every reset",
        body: "After you reset your password, we issue a second one-click link (valid 24 hours) that freezes the account if it wasn\u2019t actually you doing the reset.",
      },
      {
        heading: "Frozen accounts can\u2019t sign in",
        body: "A frozen account returns 403 on login with a clear message. Any outstanding reset links are invalidated. A super admin can restore access with one click.",
      },
      {
        heading: "Admin \u201cRestore\u201d button",
        body: "The Owners tab in /admin now shows a Frozen badge and a Restore button for any account that\u2019s been locked via this flow.",
      },
      {
        heading: "Preview mode, same shape",
        body: "We still haven\u2019t wired email in preview. The alert link is shown inline on the reset-success screen so you can try the full flow today.",
      },
    ],
  },
  {
    version: "v2.5",
    date: "Feb 2026",
    title: "Forgot-password flow",
    tag: "Update",
    highlights: [
      {
        heading: "Reset your password yourself",
        body: "A new \u201cForgot your password?\u201d link on the sign-in page. Enter your email, get a 30-minute reset link, pick a new password, and you\u2019re back in.",
      },
      {
        heading: "Privacy by default",
        body: "The API response looks the same whether or not the email is registered \u2014 attackers can\u2019t use it to fish for valid accounts.",
      },
      {
        heading: "Preview mode (no email yet)",
        body: "We\u2019re still in preview, so the reset link is shown directly on the page with copy / open buttons. Wiring up Resend or SendGrid later is a one-file change.",
      },
      {
        heading: "Auto-unlock on reset",
        body: "Resetting your password also clears any login lockout, so you can sign in immediately without waiting 15 minutes.",
      },
    ],
  },
  {
    version: "v2.4",
    date: "Feb 2026",
    title: "Security tab in the admin console",
    tag: "Security",
    highlights: [
      {
        heading: "Lockout visibility",
        body: "The super admin can now see every email that's been locked out or is approaching the threshold, with a live countdown until automatic unlock.",
      },
      {
        heading: "One-click unlock",
        body: "If a genuine owner gets locked out, the platform admin can clear the lockout instantly instead of asking them to wait 15 minutes.",
      },
      {
        heading: "Red-dot indicator",
        body: "The Security tab shows a small red dot whenever at least one account is currently locked, so issues surface without having to go looking.",
      },
    ],
  },
  {
    version: "v2.3",
    date: "Feb 2026",
    title: "Brute-force lockout on sign-in",
    tag: "Security",
    highlights: [
      {
        heading: "Account lockout after 5 failed attempts",
        body: "If a sign-in attempt uses the wrong password 5 times within 15 minutes, the account is temporarily locked and the API responds with 429. A successful sign-in resets the counter instantly.",
      },
      {
        heading: "Password guessing is now expensive",
        body: "A bot that used to try thousands of passwords per minute now gets 5 shots every 15 minutes per email — turning a few-minute attack into months of waiting.",
      },
      {
        heading: "No impact on honest users",
        body: "Mistype your password? Just try again. Once you get it right, the counter clears. No email or account reset needed.",
      },
    ],
  },
  {
    version: "v2.2",
    date: "Feb 2026",
    title: "Plans, pricing, and a super-admin panel",
    tag: "Update",
    highlights: [
      {
        heading: "Free and Premium plans",
        body: "Start on Free (1 outlet, 2 stations, 50 tokens/day) and upgrade to Premium (10 outlets, 100 stations, 1000 tokens/day, TV display, 90-day analytics). Clear limits surfaced whenever you hit them.",
      },
      {
        heading: "Pricing on the home page",
        body: "A new Pricing section on / explains both plans side-by-side so owners know what they get before signing up.",
      },
      {
        heading: "Super admin console",
        body: "New /admin area for platform admins: system stats, a list of every owner with one-click upgrade / downgrade, and an outlet explorer with delete + display shortcut.",
      },
      {
        heading: "Plan badge in the header",
        body: "Your plan is always visible. Free owners see a gentle nudge toward pricing when they bump into a limit.",
      },
    ],
  },
  {
    version: "v2.1",
    date: "Feb 2026",
    title: "What\u2019s new, right in the app",
    tag: "Update",
    highlights: [
      {
        heading: "In-app release notes",
        body: "A new What\u2019s new page surfaces every release with a small dot in the header when something fresh ships.",
      },
    ],
  },
  {
    version: "v2",
    date: "Feb 2026",
    title: "Multi-outlet, Analytics, and a Lobby TV",
    tag: "Major",
    highlights: [
      {
        heading: "Multi-outlet / chain support",
        body: "One owner can now run many outlets. Use the outlet switcher in the header or the new Outlets page to add, open or remove locations.",
      },
      {
        heading: "Owner analytics",
        body: "New Analytics tab with completions, no-show rate, average service time, a per-day bar chart, and a 7×24 busy-hour heatmap. Pick any window from 7 to 90 days.",
      },
      {
        heading: "Public TV \u201cNow Serving\u201d display",
        body: "Open the Display link on a lobby screen. Large tokens per station, up-next list, live clock — updates every few seconds, no login required.",
      },
      {
        heading: "Smarter ticket tracking",
        body: "Added a No-show action for waiting guests and an internal served_at timestamp so service-time analytics are accurate.",
      },
    ],
  },
  {
    version: "v1.1",
    date: "Feb 2026",
    title: "Signup polish",
    tag: "Update",
    highlights: [
      {
        heading: "State + Pincode required",
        body: "We capture location properly so you can show it on the customer join page and TV display.",
      },
      {
        heading: "Stations moved to Settings",
        body: "Signup is shorter — number of stations defaults to 1 and you can change it anytime from Settings.",
      },
      {
        heading: "go-next.in preview",
        body: "Your customer URL is previewed live on the signup page as you type your business name.",
      },
    ],
  },
  {
    version: "v1",
    date: "Feb 2026",
    title: "Go-Next is live",
    tag: "Launch",
    highlights: [
      {
        heading: "Live queue board",
        body: "Walk-ins, remote joins, call-next, station assignment, and a shareable QR code — all in one calm dashboard.",
      },
      {
        heading: "Customer join + live ticket",
        body: "A public page where guests join with a name and phone, then watch their position tick down in real time.",
      },
      {
        heading: "JWT auth for owners",
        body: "Secure login with httpOnly cookies. Seeded demo owner demo@go-next.in / admin123 with two outlets to explore.",
      },
    ],
  },
];
