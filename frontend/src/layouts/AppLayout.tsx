import { useMemo, useState } from "react";
import { DollarOutlined, LogoutOutlined, MenuOutlined, MonitorOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Space, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { ServiceStatusBanner } from "../components/ServiceStatusBanner";
import { ServiceStatusProvider } from "../hooks/useServiceStatus";
import { isAdminRole, ROLE_LABELS } from "../types";

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
  const [collapsed, setCollapsed] = useState(() => window.matchMedia("(max-width: 991.98px)").matches);

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
        <Space>
          {mobile ? <Button type="text" icon={<MenuOutlined />} aria-label="Меню" style={{ color: "#fff" }} onClick={() => setCollapsed((value) => !value)} /> : null}
          <Title level={4} style={{ color: "#fff", margin: 0 }}>
            Fast Ray Gram
          </Title>
        </Space>

        <Space>
          {user ? (
            <Space size={4} style={{ color: "#fff" }}>
              <Text style={{ color: "rgba(255,255,255,0.65)", textOverflow: "ellipsis" }}>{ROLE_LABELS[user.role]}</Text>
            </Space>
          ) : null}
        </Space>
      </Header>

      <ServiceStatusBanner />

      <Layout>
        <Sider
          breakpoint="lg"
          collapsedWidth={0}
          width={200}
          theme="light"
          collapsed={collapsed}
          onCollapse={setCollapsed}
          onBreakpoint={(broken) => {
            setMobile(broken);
            setCollapsed(broken);
          }}
          trigger={null}
        >
          <Menu mode="inline" selectedKeys={selectedKey} items={menuItems} onClick={({ key }) => navigate(key)} />
        </Sider>

        <Layout>
          <Content style={{ padding: "24px 16px", boxSizing: "border-box" }}>
            <Outlet />
          </Content>

          <Footer style={{ textAlign: "center" }}>
            {" "}
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
          </Footer>
        </Layout>
      </Layout>
      </Layout>
    </ServiceStatusProvider>
  );
}
