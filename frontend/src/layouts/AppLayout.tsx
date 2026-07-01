import { useEffect, useMemo, useState } from "react";
import { DollarOutlined, LogoutOutlined, MenuOutlined, MonitorOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Drawer, Flex, Layout, Menu, Space, Typography, theme } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { ServiceStatusBanner } from "../components/ServiceStatusBanner";
import { ThemeToggle } from "../components/ThemeToggle";
import { ServiceStatusProvider } from "../hooks/useServiceStatus";
import { useTheme } from "../theme/ThemeProvider";
import { getSidebarBg } from "../theme/config";
import { isAdminRole } from "../types";

const { Header, Sider, Content, Footer } = Layout;
const { Text, Title } = Typography;

const ALL_MENU_ITEMS = [
  { key: "/profile", icon: <UserOutlined />, label: "Профиль" },
  { key: "/monitoring", icon: <MonitorOutlined />, label: "Мониторинг", adminOnly: true },
  { key: "/payments", icon: <DollarOutlined />, label: "Платежи", adminOnly: true },
  { key: "/users", icon: <TeamOutlined />, label: "Пользователи", adminOnly: true },
];

const HEADER_BG = "#000000";
const HEADER_TEXT = "#ffffff";

export function AppLayout() {
  const { token } = theme.useToken();
  const { user, logout } = useAuth();
  const { resolved } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 991.98px)").matches);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuTheme = resolved === "dark" ? "dark" : "light";
  const sidebarBg = getSidebarBg(resolved);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 991.98px)");
    const sync = () => {
      setMobile(media.matches);
      if (media.matches) {
        setMenuOpen(false);
      }
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const menuItems = useMemo(() => {
    const showAdmin = user ? isAdminRole(user.role) : false;
    return ALL_MENU_ITEMS.filter((item) => !item.adminOnly || showAdmin).map(({ key, icon, label }) => ({
      key,
      icon,
      label,
    }));
  }, [user]);

  const selectedKey = useMemo(() => {
    const match = ALL_MENU_ITEMS.find((item) => location.pathname.startsWith(item.key));
    return match ? [match.key] : [];
  }, [location.pathname]);

  const onMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (mobile) {
      setMenuOpen(false);
    }
  };

  const menu = <Menu className="app-menu" mode="inline" theme={menuTheme} selectedKeys={selectedKey} items={menuItems} onClick={onMenuClick} style={{ background: sidebarBg }} />;

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: 24,
    background: HEADER_BG,
    color: HEADER_TEXT,
    borderBottom: `1px solid ${resolved === "dark" ? "#303030" : "#1f1f1f"}`,
  } as const;

  const footerStyle = {
    textAlign: "center" as const,
    background: token.colorBgContainer,
    borderTop: `1px solid ${token.colorBorderSecondary}`,
  };

  return (
    <ServiceStatusProvider>
      <Layout style={{ minHeight: "100vh", background: token.colorBgLayout }}>
        <Header style={headerStyle}>
          <Flex align="center" gap={12}>
            <img src="/frg_light_on_dark.png" alt="" aria-hidden style={{ height: mobile ? 28 : 36, display: "block" }} />
            <Title level={4} style={{ margin: 0, color: HEADER_TEXT }}>
              Fast Ray Gram
            </Title>
          </Flex>
          {mobile ? <Button type="text" icon={<MenuOutlined />} aria-label="Меню" style={{ color: HEADER_TEXT }} onClick={() => setMenuOpen(true)} /> : null}
        </Header>

        <ServiceStatusBanner />

        <Layout style={{ background: token.colorBgLayout }}>
          {mobile ? (
            <Drawer title="Меню" placement="right" open={menuOpen} onClose={() => setMenuOpen(false)} width={240} styles={{ body: { padding: 0 } }}>
              {menu}
            </Drawer>
          ) : (
            <Sider className="app-sider" width={200} theme={menuTheme} style={{ background: sidebarBg, borderRight: `1px solid ${token.colorBorderSecondary}` }}>
              {menu}
            </Sider>
          )}

          <Layout style={{ background: token.colorBgLayout }}>
            <Content style={{ padding: "24px 16px", boxSizing: "border-box" }}>
              <Outlet />
            </Content>

            <Footer style={footerStyle}>
              <Space wrap style={{ justifyContent: "center" }}>
                <Text type="secondary" style={{ paddingRight: 8, paddingLeft: 8 }}>
                  v1.4.2
                </Text>
                <ThemeToggle />
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  Выйти
                </Button>
              </Space>
            </Footer>
          </Layout>
        </Layout>
      </Layout>
    </ServiceStatusProvider>
  );
}
