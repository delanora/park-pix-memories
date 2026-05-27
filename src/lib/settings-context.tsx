import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { getSiteSettings, SETTINGS_DEFAULTS, type SiteSettings } from "./settings.functions";
import { useAuth } from "./auth-context";

const SettingsContext = createContext<SiteSettings>(SETTINGS_DEFAULTS);

/** Decide which tenant slug we should theme for, based on URL + auth. */
function useResolvedSlug(): { slug: string | null; applyTheme: boolean } {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { tenantSlug } = useAuth();

  // Public per-tenant routes: /e/{slug}/...
  const m = pathname.match(/^\/e\/([^/]+)/);
  if (m) return { slug: m[1], applyTheme: true };

  // Super admin panel — neutral default theme
  if (pathname.startsWith("/admin")) return { slug: null, applyTheme: false };

  // Operator/customer inside the app — theme from their tenant
  if (pathname.startsWith("/operador") || pathname.startsWith("/cliente")) {
    return { slug: tenantSlug, applyTheme: !!tenantSlug };
  }

  // Root landing & global login pages — neutral default theme
  return { slug: null, applyTheme: false };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const fetchSettings = useServerFn(getSiteSettings);
  const { slug, applyTheme } = useResolvedSlug();

  const { data } = useQuery({
    queryKey: ["site-settings", slug ?? "__default__"],
    queryFn: () => fetchSettings({ data: { slug: slug ?? undefined } }),
    staleTime: 60_000,
  });

  const settings = data ?? SETTINGS_DEFAULTS;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const keys = [
      "--primary", "--ring", "--sidebar-primary", "--sidebar-ring",
      "--secondary", "--accent", "--background", "--card", "--muted",
      "--foreground", "--gradient-sunset",
    ];

    if (!applyTheme) {
      keys.forEach((k) => root.style.removeProperty(k));
      document.title = SETTINGS_DEFAULTS.metaTitle;
      return;
    }

    root.style.setProperty("--primary", settings.primaryColor);
    root.style.setProperty("--ring", settings.primaryColor);
    root.style.setProperty("--sidebar-primary", settings.primaryColor);
    root.style.setProperty("--sidebar-ring", settings.primaryColor);
    root.style.setProperty("--secondary", settings.secondaryColor);
    root.style.setProperty("--accent", settings.accentColor);
    root.style.setProperty("--background", settings.backgroundColor);
    root.style.setProperty("--card", settings.cardBackgroundColor);
    root.style.setProperty("--muted", settings.mutedBackgroundColor);
    root.style.setProperty("--foreground", settings.foregroundColor);
    root.style.setProperty(
      "--gradient-sunset",
      `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.accentColor} 60%, ${settings.secondaryColor} 100%)`,
    );
    document.title = settings.metaTitle;
  }, [settings, applyTheme]);

  return (
    <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
