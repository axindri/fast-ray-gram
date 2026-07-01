import { useMemo } from "react";
import { Flex, Menu, Typography, theme } from "antd";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { NAV_ITEMS } from "../config/navigation";
import { getSidebarBg } from "../theme/config";
import { isAdminRole } from "../types";

const { Text } = Typography;

export const APP_VERSION = "v2.5.0";

type AppSidebarMenuProps = {
  menuTheme: "light" | "dark";
  resolved: "light" | "dark";
  selectedKey: string[];
  onNavigate?: () => void;
};

export function AppSidebarMenu({ menuTheme, resolved, selectedKey, onNavigate }: AppSidebarMenuProps) {
  const { token } = theme.useToken();
  const { user } = useAuth();
  const navigate = useNavigate();
  const sidebarBg = getSidebarBg(resolved);

  const menuItems = useMemo<MenuProps["items"]>(() => {
    const showAdmin = user ? isAdminRole(user.role) : false;
    return NAV_ITEMS.filter((item) => !item.adminOnly || showAdmin).map(({ path, Icon, label }) => ({
      key: path,
      icon: <Icon />,
      label,
    }));
  }, [user]);

  const onMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(key);
    onNavigate?.();
  };

  return (
    <Flex vertical style={{ height: "100%", background: sidebarBg }}>
      <Menu className="app-menu" mode="inline" theme={menuTheme} selectedKeys={selectedKey} items={menuItems} onClick={onMenuClick} style={{ flex: 1, borderInlineEnd: 0, background: sidebarBg }} />

      <div
        className="app-chrome-bar app-sidebar-chrome"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: sidebarBg,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12, paddingInline: 4 }}>
          {APP_VERSION}
        </Text>
      </div>
    </Flex>
  );
}
