import { CopyOutlined, DollarOutlined, LinkOutlined, LoadingOutlined, MonitorOutlined, ReloadOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { App, Avatar, Button, Card, Empty, Flex, Form, Input, InputNumber, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { createInvoice, fetchConfig, formatDate } from "../api";
import { useAuth } from "../auth";
import { useServiceStatus } from "../hooks/useServiceStatus";
import { INVOICE_STATUS_LABELS, ROLE_LABELS, invoiceStatusColor, isAdminRole, type Invoice, type UserRole } from "../types";
import { copyToClipboard } from "../utils/clipboard";

const { Title, Text } = Typography;

const APP_SECTIONS: { path: string; label: string; hint: string; icon: ReactNode; adminOnly?: boolean }[] = [
  { path: "/profile", label: "Профиль", hint: "Подписка и платежи", icon: <UserOutlined /> },
  { path: "/monitoring", label: "Мониторинг", hint: "Статус сервисов и ссылки на панели", icon: <MonitorOutlined />, adminOnly: true },
  { path: "/payments", label: "Платежи", hint: "Проверка и управление инвойсами", icon: <DollarOutlined />, adminOnly: true },
  { path: "/users", label: "Пользователи", hint: "Создание пользователей и XUI-клиентов", icon: <TeamOutlined />, adminOnly: true },
];

function AvailableSectionsCard({ role }: { role: UserRole }) {
  const sections = useMemo(() => APP_SECTIONS.filter((section) => (!section.adminOnly || isAdminRole(role)) && section.path !== "/profile"), [role]);

  if (!sections.length) {
    return null;
  }

  return (
    <Card title="Для тебя доступны разделы">
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        {sections.map(({ path, label, hint, icon }) => (
          <Link key={path} to={path} style={{ display: "block", color: "inherit" }}>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <Flex align="center" gap={12}>
                <Avatar shape="square" size="small" icon={icon} style={{ backgroundColor: "#1677ff" }} />
                <Flex vertical gap={0}>
                  <Text strong>{label}</Text>
                  <Text type="secondary">{hint}</Text>
                </Flex>
              </Flex>
            </Card>
          </Link>
        ))}
      </Space>
    </Card>
  );
}

function displayName(username: string) {
  const name = username.includes("@") ? username.split("@")[0] : username;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function avatarLetter(username: string) {
  return displayName(username).charAt(0).toUpperCase();
}

function ProfileInvoiceCard({ item, paymentBlocked }: { item: Invoice; paymentBlocked: boolean }) {
  const status = String(item.status || "").toLowerCase();
  const isPending = status === "pending";
  const canPay = isPending && item.confirmation_url && !paymentBlocked;

  return (
    <Card size="small" title={`#${item.invoice_id}`} extra={<Tag color={invoiceStatusColor(status)}>{INVOICE_STATUS_LABELS[status] || status || "—"}</Tag>}>
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        <Text type="secondary">Идентификатор (ID): {item.id}</Text>
        <Text type="secondary">Создан: {formatDate(item.created_at)}</Text>

        {isPending && item.confirmation_url ? (
          <>
            <Button type="primary" href={item.confirmation_url} target="_blank" rel="noreferrer" disabled={!canPay}>
              Оплатить
            </Button>
          </>
        ) : null}
      </Space>
    </Card>
  );
}

type PaymentForm = {
  amount: number;
};

export function ProfilePage() {
  const { message } = App.useApp();
  const { user, refreshUser } = useAuth();
  const [paymentForm] = Form.useForm<PaymentForm>();

  const [minAmount, setMinAmount] = useState(100);
  const [maxAmount, setMaxAmount] = useState(1000);
  const { loading: statusLoading, paymentBlocked } = useServiceStatus();
  const [profileLoading, setProfileLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      await refreshUser();
    } catch {
      message.error("Не удалось обновить профиль");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void fetchConfig().then((config) => {
      if (cancelled) {
        return;
      }

      setMinAmount(config.min_invoice_amount);
      setMaxAmount(config.max_invoice_amount);
      paymentForm.setFieldValue("amount", config.min_invoice_amount);
    });

    return () => {
      cancelled = true;
    };
  }, [paymentForm]);

  if (!user) {
    return null;
  }

  const name = displayName(user.username);
  const invoices = user.invoices ?? [];
  const paymentsDisabled = statusLoading || paymentBlocked;

  const onCreatePayment = async (values: PaymentForm) => {
    if (paymentsDisabled) {
      return;
    }

    setPaymentLoading(true);

    try {
      const invoice = await createInvoice(values.amount);
      window.open(invoice.confirmation_url, "_blank", "noopener,noreferrer");
      await refreshUser();
      message.success("Счёт создан, открыта страница оплаты");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось создать платёж");
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Flex align="center" gap="large" wrap="wrap">
          <Avatar size={72} icon={<UserOutlined />} style={{ backgroundColor: "#1677ff", flexShrink: 0 }}>
            {avatarLetter(user.username)}
          </Avatar>

          <Flex vertical gap={4}>
            <Title level={3} style={{ margin: 0 }}>
              Привет, {name}!
            </Title>
            <Space>
              <Tag color="blue">{ROLE_LABELS[user.role]}</Tag>
              <Tag>ID {user.id}</Tag>
            </Space>
          </Flex>
        </Flex>
      </Card>

      {user.sub_url && (
        <Card
          title={
            <Flex align="center" gap={8}>
              <Avatar shape="square" size="small" icon={<LinkOutlined />} style={{ backgroundColor: "#1677ff" }} />
              <span>Ссылка подписки</span>
            </Flex>
          }
        >
          <Text type="secondary">Добавьте ссылку в VPN-клиент для подключения</Text>

          <div style={{ marginTop: 16 }}>
            <Space.Compact style={{ width: "100%", maxWidth: 640 }}>
              <Input value={user.sub_url} readOnly />
              <Button
                icon={<CopyOutlined />}
                aria-label="Скопировать"
                onClick={() => {
                  void copyToClipboard(user.sub_url)
                    .then(() => message.success("Скопировано"))
                    .catch(() => message.error("Не удалось скопировать"));
                }}
              />
            </Space.Compact>
          </div>
        </Card>
      )}

      {user.role !== "superuser" ? (
        <>
          <Card
            title={
              <Flex align="center" gap={8}>
                <Avatar shape="square" size="small" icon={<DollarOutlined />} style={{ backgroundColor: "#1677ff" }} />
                <span>Платежи</span>
              </Flex>
            }
          >
            <Text type="secondary">Создайте новый счёт для оплаты подписки</Text>
            <Form form={paymentForm} layout="inline" onFinish={onCreatePayment} style={{ marginTop: 16 }}>
              <Form.Item
                label="Сумма, ₽"
                name="amount"
                rules={[
                  { required: true, message: "Введите сумму" },
                  { type: "number", min: minAmount, max: maxAmount, message: `От ${minAmount} до ${maxAmount} ₽` },
                ]}
              >
                <InputNumber min={minAmount} max={maxAmount} disabled={paymentsDisabled} />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={paymentLoading} disabled={paymentsDisabled}>
                    Создать платёж
                  </Button>
                  {statusLoading ? <Spin indicator={<LoadingOutlined spin />} size="medium" /> : null}
                </Space>
              </Form.Item>
            </Form>
          </Card>

          <Card
            title="Мои инвойсы"
            extra={
              <Button icon={<ReloadOutlined />} loading={profileLoading} onClick={() => void loadProfile()}>
                Обновить
              </Button>
            }
          >
            <div style={{ marginTop: 16 }}>
              {profileLoading && !invoices.length ? (
                <Flex justify="center" align="center" style={{ minHeight: 120 }}>
                  <Spin indicator={<LoadingOutlined spin />} size="large" />
                </Flex>
              ) : null}

              {!profileLoading && !invoices.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Инвойсов пока нет" /> : null}

              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {invoices.map((item) => (
                  <ProfileInvoiceCard key={item.id} item={item} paymentBlocked={paymentsDisabled} />
                ))}
              </Space>
            </div>
          </Card>
          <AvailableSectionsCard role={user.role} />
        </>
      ) : (
        <AvailableSectionsCard role={user.role} />
      )}
    </Space>
  );
}
