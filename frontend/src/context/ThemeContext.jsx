import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api } from "../lib/api";

const ThemeContext = createContext(null);

// Google Fonts loader — loads only the fonts needed for the active theme
const FONT_URLS = {
  "warm-sand":
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600&display=swap",
  midnight:
    "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap",
  matcha:
    "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600&family=Noto+Sans+JP:wght@300;400;500&display=swap",
  arctic:
    "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Manrope:wght@300;400;500;600&display=swap",
  bloom:
    "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;1,300&family=Nunito:wght@300;400;500;600&display=swap",
};

function loadFont(themeId) {
  const url = FONT_URLS[themeId];
  if (!url) return;
  const existingId = `font-link-${themeId}`;
  if (document.getElementById(existingId)) return; // already loaded
  const link = document.createElement("link");
  link.id = existingId;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

export const THEMES = [
  {
    id: "warm-sand",
    name: "Warm Sand",
    description: "Organic & elegant — the classic salon feel",
    mode: "light",
    preview: { bg: "#F9F8F6", accent: "#C47C5C", text: "#2C302E" },
    fonts: {
      display: "'Cormorant Garamond', Georgia, serif",
      body: "'Outfit', system-ui, sans-serif",
    },
    vars: {
      "--background": "36 22% 97%",
      "--foreground": "150 5% 18%",
      "--card": "0 0% 100%",
      "--card-foreground": "150 5% 18%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "150 5% 18%",
      "--primary": "18 44% 56%",
      "--primary-foreground": "36 22% 97%",
      "--secondary": "40 15% 92%",
      "--secondary-foreground": "150 5% 18%",
      "--muted": "40 15% 92%",
      "--muted-foreground": "150 3% 40%",
      "--accent": "36 18% 92%",
      "--accent-foreground": "150 5% 18%",
      "--success": "101 12% 53%",
      "--success-foreground": "0 0% 100%",
      "--border": "36 12% 88%",
      "--input": "36 12% 88%",
      "--ring": "18 44% 56%",
      "--app-bg": "#F9F8F6",
      "--app-text": "#2C302E",
      "--app-accent": "#C47C5C",
      "--app-accent-text": "#A86246",
      "--app-success": "#7D9276",
      "--app-surface": "#FFFFFF",
      "--app-border": "#E7E5E4",
      "--app-text-muted": "#78716C",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Luxury noir — dark, sharp & dramatic",
    mode: "dark",
    preview: { bg: "#0F1117", accent: "#818CF8", text: "#E8EAF0" },
    fonts: {
      display: "'Playfair Display', Georgia, serif",
      body: "'Inter', system-ui, sans-serif",
    },
    vars: {
      "--background": "228 26% 8%",
      "--foreground": "228 20% 91%",
      "--card": "228 24% 12%",
      "--card-foreground": "228 20% 91%",
      "--popover": "228 24% 12%",
      "--popover-foreground": "228 20% 91%",
      "--primary": "234 89% 74%",
      "--primary-foreground": "228 26% 8%",
      "--secondary": "228 20% 18%",
      "--secondary-foreground": "228 20% 91%",
      "--muted": "228 20% 18%",
      "--muted-foreground": "228 10% 55%",
      "--accent": "228 20% 18%",
      "--accent-foreground": "228 20% 91%",
      "--success": "158 70% 67%",
      "--success-foreground": "228 26% 8%",
      "--border": "228 20% 20%",
      "--input": "228 20% 20%",
      "--ring": "234 89% 74%",
      "--app-bg": "#0F1117",
      "--app-text": "#E8EAF0",
      "--app-accent": "#818CF8",
      "--app-accent-text": "#A5B4FC",
      "--app-success": "#6EE7B7",
      "--app-surface": "#1A1D27",
      "--app-border": "#2E3147",
      "--app-text-muted": "#8B8FA8",
    },
  },
  {
    id: "matcha",
    name: "Matcha",
    description: "Japanese minimalism — calm, balanced & refined",
    mode: "light",
    preview: { bg: "#F4F6F0", accent: "#5C7A4E", text: "#1C2B1A" },
    fonts: {
      display: "'Noto Serif JP', Georgia, serif",
      body: "'Noto Sans JP', system-ui, sans-serif",
    },
    vars: {
      "--background": "90 18% 95%",
      "--foreground": "100 22% 14%",
      "--card": "0 0% 100%",
      "--card-foreground": "100 22% 14%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "100 22% 14%",
      "--primary": "100 22% 39%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "90 14% 90%",
      "--secondary-foreground": "100 22% 14%",
      "--muted": "90 14% 90%",
      "--muted-foreground": "100 8% 44%",
      "--accent": "90 14% 90%",
      "--accent-foreground": "100 22% 14%",
      "--success": "100 32% 59%",
      "--success-foreground": "0 0% 100%",
      "--border": "90 12% 84%",
      "--input": "90 12% 84%",
      "--ring": "100 22% 39%",
      "--app-bg": "#F4F6F0",
      "--app-text": "#1C2B1A",
      "--app-accent": "#5C7A4E",
      "--app-accent-text": "#4A6340",
      "--app-success": "#8FAF7E",
      "--app-surface": "#FFFFFF",
      "--app-border": "#D4DDC8",
      "--app-text-muted": "#6B7B60",
    },
  },
  {
    id: "arctic",
    name: "Arctic",
    description: "Crisp Scandinavian — icy, minimal & bold",
    mode: "light",
    preview: { bg: "#F0F4F8", accent: "#2D6A9F", text: "#1A2433" },
    fonts: {
      display: "'Syne', system-ui, sans-serif",
      body: "'Manrope', system-ui, sans-serif",
    },
    vars: {
      "--background": "210 30% 96%",
      "--foreground": "214 40% 16%",
      "--card": "0 0% 100%",
      "--card-foreground": "214 40% 16%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "214 40% 16%",
      "--primary": "210 55% 40%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "210 20% 90%",
      "--secondary-foreground": "214 40% 16%",
      "--muted": "210 20% 90%",
      "--muted-foreground": "214 14% 46%",
      "--accent": "210 20% 90%",
      "--accent-foreground": "214 40% 16%",
      "--success": "161 50% 36%",
      "--success-foreground": "0 0% 100%",
      "--border": "210 20% 84%",
      "--input": "210 20% 84%",
      "--ring": "210 55% 40%",
      "--app-bg": "#F0F4F8",
      "--app-text": "#1A2433",
      "--app-accent": "#2D6A9F",
      "--app-accent-text": "#1E5480",
      "--app-success": "#2E8B6E",
      "--app-surface": "#FFFFFF",
      "--app-border": "#C8D6E5",
      "--app-text-muted": "#5A6E82",
    },
  },
  {
    id: "bloom",
    name: "Bloom",
    description: "Soft floral spa — warm, gentle & welcoming",
    mode: "light",
    preview: { bg: "#FDF6F7", accent: "#C2607A", text: "#3D1A24" },
    fonts: {
      display: "'Fraunces', Georgia, serif",
      body: "'Nunito', system-ui, sans-serif",
    },
    vars: {
      "--background": "350 60% 98%",
      "--foreground": "344 38% 18%",
      "--card": "0 0% 100%",
      "--card-foreground": "344 38% 18%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "344 38% 18%",
      "--primary": "344 44% 56%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "350 30% 92%",
      "--secondary-foreground": "344 38% 18%",
      "--muted": "350 30% 92%",
      "--muted-foreground": "344 14% 50%",
      "--accent": "350 30% 92%",
      "--accent-foreground": "344 38% 18%",
      "--success": "132 27% 59%",
      "--success-foreground": "0 0% 100%",
      "--border": "350 24% 86%",
      "--input": "350 24% 86%",
      "--ring": "344 44% 56%",
      "--app-bg": "#FDF6F7",
      "--app-text": "#3D1A24",
      "--app-accent": "#C2607A",
      "--app-accent-text": "#A84D65",
      "--app-success": "#7DAF8A",
      "--app-surface": "#FFFFFF",
      "--app-border": "#EDD5DA",
      "--app-text-muted": "#8A5E68",
    },
  },
];

export const DEFAULT_THEME_ID = "warm-sand";

export function applyTheme(themeIdOrObj) {
  const id =
    typeof themeIdOrObj === "string" ? themeIdOrObj : themeIdOrObj?.theme_id;
  const t = THEMES.find((t) => t.id === id) || THEMES[0];

  // Load Google Fonts for this theme
  loadFont(t.id);

  const root = document.documentElement;

  // Apply shadcn + custom CSS variables
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));

  // Apply fonts
  root.style.setProperty("--font-display", t.fonts.display);
  root.style.setProperty("--font-body", t.fonts.body);
  document.body.style.fontFamily = t.fonts.body;

  // Dark mode
  if (t.mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");

  // Body overrides
  document.body.style.background = t.vars["--app-bg"];
  document.body.style.color = t.vars["--app-text"];

  root.setAttribute("data-theme", t.id);
  root.setAttribute("data-theme-mode", t.mode);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState({ theme_id: DEFAULT_THEME_ID });
  const [loading, setLoading] = useState(true);

  const fetchTheme = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/theme");
      setThemeState(data);
      applyTheme(data);
    } catch {
      applyTheme(DEFAULT_THEME_ID);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  const updateTheme = async (themeId) => {
    applyTheme(themeId);
    setThemeState({ theme_id: themeId });
  };

  return (
    <ThemeContext.Provider
      value={{ theme, updateTheme, loading, refetch: fetchTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
