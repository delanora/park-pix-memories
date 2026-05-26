import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSiteSettings, SETTINGS_DEFAULTS, type SiteSettings } from "./settings.functions";

const SettingsContext = createContext<SiteSettings>(SETTINGS_DEFAULTS);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const fetchSettings = useServerFn(getSiteSettings);
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 60_000,
  });

  const settings = data ?? SETTINGS_DEFAULTS;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--primary", settings.primaryColor);
    root.style.setProperty("--ring", settings.primaryColor);
    root.style.setProperty("--sidebar-primary", settings.primaryColor);
    root.style.setProperty("--sidebar-ring", settings.primaryColor);
    root.style.setProperty("--secondary", settings.secondaryColor);
    root.style.setProperty("--accent", settings.accentColor);
    root.style.setProperty(
      "--gradient-sunset",
      `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.accentColor} 60%, ${settings.secondaryColor} 100%)`,
    );
    document.title = settings.metaTitle;
  }, [settings]);

  return (
    <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
