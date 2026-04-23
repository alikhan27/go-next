// Single source of truth for the "What's new" feed inside the app.
// When adding a new release, bump LATEST_VERSION and prepend an entry.

export const LATEST_VERSION = "v2.2";

export const RELEASES = [
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
        body: "Secure login with httpOnly cookies. Seeded demo owner admin@go-next.in / admin123 with two outlets to explore.",
      },
    ],
  },
];
