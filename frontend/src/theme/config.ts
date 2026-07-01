import { theme, type ThemeConfig } from "antd";

export type ThemeMode = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const sidebarTokens = {
  light: {
    siderBg: "#ffffff",
    menuBg: "#ffffff",
    itemColor: "rgba(0, 0, 0, 0.65)",
    itemHoverBg: "rgba(0, 0, 0, 0.04)",
    itemHoverColor: "rgba(0, 0, 0, 0.88)",
    itemSelectedBg: "rgba(0, 0, 0, 0.06)",
    itemSelectedColor: "rgba(0, 0, 0, 0.88)",
  },
  dark: {
    siderBg: "#141414",
    menuBg: "#141414",
    itemColor: "rgba(255, 255, 255, 0.65)",
    itemHoverBg: "rgba(255, 255, 255, 0.04)",
    itemHoverColor: "rgba(255, 255, 255, 0.85)",
    itemSelectedBg: "rgba(255, 255, 255, 0.08)",
    itemSelectedColor: "rgba(255, 255, 255, 0.85)",
  },
} as const;

export function getThemeConfig(resolved: ResolvedTheme): ThemeConfig {
  const isDark = resolved === "dark";
  const sidebar = isDark ? sidebarTokens.dark : sidebarTokens.light;

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    components: {
      Layout: {
        siderBg: sidebar.siderBg,
        lightSiderBg: sidebarTokens.light.siderBg,
        triggerBg: isDark ? "#1f1f1f" : "#fafafa",
        lightTriggerBg: "#fafafa",
      },
      Menu: {
        activeBarWidth: 0,
        itemBg: sidebar.menuBg,
        subMenuItemBg: sidebar.menuBg,
        itemColor: sidebar.itemColor,
        itemHoverBg: sidebar.itemHoverBg,
        itemHoverColor: sidebar.itemHoverColor,
        itemSelectedBg: sidebar.itemSelectedBg,
        itemSelectedColor: sidebar.itemSelectedColor,
        darkItemBg: sidebarTokens.dark.menuBg,
        darkSubMenuItemBg: sidebarTokens.dark.menuBg,
        darkItemColor: sidebarTokens.dark.itemColor,
        darkItemHoverBg: sidebarTokens.dark.itemHoverBg,
        darkItemHoverColor: sidebarTokens.dark.itemHoverColor,
        darkItemSelectedBg: sidebarTokens.dark.itemSelectedBg,
        darkItemSelectedColor: sidebarTokens.dark.itemSelectedColor,
      },
    },
  };
}

export function getSidebarBg(resolved: ResolvedTheme) {
  return resolved === "dark" ? sidebarTokens.dark.siderBg : sidebarTokens.light.siderBg;
}

export function readStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}
