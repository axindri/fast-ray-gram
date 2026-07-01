import { useEffect, useMemo, useState } from "react";
import { DollarOutlined, LogoutOutlined, MenuOutlined, MonitorOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Space, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { ServiceStatusBanner } from "../components/ServiceStatusBanner";
import { ServiceStatusProvider } from "../hooks/useServiceStatus";
import { isAdminRole } from "../types";

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

const ALL_MENU_ITEMS = [
  { key: "/profile", icon: <UserOutlined />, label: "Профиль" },
  { key: "/monitoring", icon: <MonitorOutlined />, label: "Мониторинг", adminOnly: true },
  { key: "/payments", icon: <DollarOutlined />, label: "Платежи", adminOnly: true },
  { key: "/users", icon: <TeamOutlined />, label: "Пользователи", adminOnly: true },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 991.98px)").matches);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const menu = <Menu mode="inline" selectedKeys={selectedKey} items={menuItems} onClick={onMenuClick} />;

  return (
    <ServiceStatusProvider>
      <Layout style={{ minHeight: "100vh" }}>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingInline: 24,
          }}
        >
          <Title level={4} style={{ color: "#fff", margin: 0 }}>
            Fast Ray Gram
          </Title>
          {mobile ? <Button type="text" icon={<MenuOutlined />} aria-label="Меню" style={{ color: "#fff" }} onClick={() => setMenuOpen(true)} /> : null}
        </Header>

        <ServiceStatusBanner />

        <Layout>
          {mobile ? (
            <Drawer title="Меню" placement="right" open={menuOpen} onClose={() => setMenuOpen(false)} width={240} styles={{ body: { padding: 0 } }}>
              {menu}
            </Drawer>
          ) : (
            <Sider width={200} theme="light">
              {menu}
            </Sider>
          )}

          <Layout>
            <Content style={{ padding: "24px 16px", boxSizing: "border-box" }}>
              <Outlet />
            </Content>

            <Footer style={{ textAlign: "center" }}>
              <Space>
                <Text type="secondary">v1.2.0</Text>
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
