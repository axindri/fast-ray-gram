import { DesktopOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Button, Dropdown, type MenuProps } from "antd";

import { useTheme } from "../theme/ThemeProvider";
import type { ThemeMode } from "../theme/config";

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Светлая",
  dark: "Тёмная",
  system: "Системная",
};

const MODE_ICONS: Record<ThemeMode, React.ReactNode> = {
  light: <SunOutlined />,
  dark: <MoonOutlined />,
  system: <DesktopOutlined />,
};

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  const items: MenuProps["items"] = (["light", "dark", "system"] as ThemeMode[]).map((value) => ({
    key: value,
    label: MODE_LABELS[value],
    icon: MODE_ICONS[value],
  }));

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [mode],
        onClick: ({ key }) => setMode(key as ThemeMode),
      }}
      trigger={["click"]}
    >
      <Button type="text" icon={MODE_ICONS[mode]} aria-label="Тема">
        {MODE_LABELS[mode]}
      </Button>
    </Dropdown>
  );
}
