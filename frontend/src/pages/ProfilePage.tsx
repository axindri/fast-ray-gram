import { AppstoreOutlined, CopyOutlined, DollarOutlined, FileOutlined, LoadingOutlined, MonitorOutlined, ReloadOutlined, TeamOutlined, UserOutlined, WifiOutlined } from "@ant-design/icons";
import { App, Button, Card, Empty, Flex, Form, Input, InputNumber, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { createInvoice, fetchConfig, fetchXuiMe, formatDate } from "../api";
import { useAuth } from "../auth";
import { ThemedIconAvatar } from "../components/ThemedIconAvatar";
import { useServiceStatus } from "../hooks/useServiceStatus";
import { INVOICE_STATUS_LABELS, ROLE_LABELS, invoiceStatusColor, isAdminRole, type Invoice, type UserRole, type XuiClient } from "../types";
import { copyToClipboard } from "../utils/clipboard";

const { Title, Text } = Typography;

const APP_SECTIONS: { path: string; label: string; hint: string; icon: ReactNode; adminOnly?: boolean }[] = [
  { path: "/profile", label: "Профиль", hint: "Подписка и платежи", icon: <UserOutlined /> },
  { path: "/monitoring", label: "Мониторинг", hint: "Статус сервисов и ссылки на панели", icon: <MonitorOutlined />, adminOnly: true },
  { path: "/payments", label: "Платежи", hint: "Проверка и управление счетами к оплате", icon: <DollarOutlined />, adminOnly: true },
  { path: "/users", label: "Пользователи", hint: "Создание пользователей и XUI-клиентов", icon: <TeamOutlined />, adminOnly: true },
];

function AvailableSectionsCard({ role }: { role: UserRole }) {
  const sections = useMemo(() => APP_SECTIONS.filter((section) => (!section.adminOnly || isAdminRole(role)) && section.path !== "/profile"), [role]);

  if (!sections.length) {
    return null;
  }

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <ThemedIconAvatar shape="square" size="small" icon={<AppstoreOutlined />} />
          <span>Для тебя доступны разделы</span>
        </Flex>
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        {sections.map(({ path, label, hint, icon }) => (
          <Link key={path} to={path} style={{ display: "block", color: "inherit" }}>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <Flex align="center" gap={12}>
                <ThemedIconAvatar shape="square" size="small" icon={icon} />
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

function formatTraffic(usedBytes: number, totalGb: number): string {
  const usedGb = (usedBytes / 1024 ** 3).toFixed(2);

  if (!totalGb) {
    return `${usedGb} GB / без лимита`;
  }

  return `${usedGb} / ${totalGb} GB`;
}

function formatLimitIps(limitIps: number): string {
  if (!limitIps) {
    return "без лимита";
  }

  return String(limitIps);
}

function XuiSubscriptionCard({ client }: { client: XuiClient }) {
  const { message } = App.useApp();

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <ThemedIconAvatar shape="square" size="small" icon={<WifiOutlined />} />
          <span>Подписка</span>
        </Flex>
      }
      extra={
        <Tag color={client.enable ? "green" : "red"} style={{ marginInlineStart: 4 }}>
          {client.enable ? "Включена" : "Выключена"}
        </Tag>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        <Text>
          Трафик: <Text strong>{formatTraffic(client.used_traffic, client.total_gb)}</Text>
        </Text>
        <Text>
          Лимит IP: <Text strong>{formatLimitIps(client.limit_ips)}</Text>
        </Text>
        <Text>Действует до: {formatDate(client.expiry_datetime)}</Text>

        {client.sub_url ? (
          <div style={{ marginTop: 12 }}>
            <Text style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Добавьте ссылку в VPN-клиент для подключения</Text>

            <Space.Compact style={{ width: "100%", maxWidth: 640 }}>
              <Input value={client.sub_url} readOnly />
              <Button
                icon={<CopyOutlined />}
                aria-label="Скопировать"
                onClick={() =>
                  void copyToClipboard(client.sub_url)
                    .then(() => message.success("Скопировано"))
                    .catch(() => message.error("Не удалось скопировать"))
                }
              />
            </Space.Compact>
          </div>
        ) : null}
      </Space>
    </Card>
  );
}

function ProfileInvoiceCard({ item, paymentBlocked }: { item: Invoice; paymentBlocked: boolean }) {
  const status = String(item.status || "").toLowerCase();
  const isPending = status === "pending";
  const canPay = isPending && item.confirmation_url && !paymentBlocked;

  return (
    <Card size="small" title={`#${item.invoice_id} · ${item.amount} ₽`} extra={<Tag color={invoiceStatusColor(status)}>{INVOICE_STATUS_LABELS[status] || status || "—"}</Tag>}>
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        <Text type="secondary">Создан: {formatDate(item.created_at)}</Text>
        <Text type="secondary">Обновлен: {formatDate(item.updated_at)}</Text>

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
  const [xuiClient, setXuiClient] = useState<XuiClient | null>(null);
  const [xuiLoading, setXuiLoading] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 991.98px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 991.98px)");
    const sync = () => setMobile(media.matches);

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const loadXuiClient = async () => {
    setXuiLoading(true);

    try {
      setXuiClient(await fetchXuiMe());
    } catch {
      setXuiClient(null);
    } finally {
      setXuiLoading(false);
    }
  };

  const loadProfile = async () => {
    setProfileLoading(true);

    try {
      const profile = await refreshUser();
      if (profile.role !== "superuser") {
        await loadXuiClient();
      } else {
        setXuiClient(null);
      }
    } catch {
      message.error("Не удалось обновить профиль");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== "superuser") {
      void loadXuiClient();
    }
  }, [user?.id, user?.role]);

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
          <ThemedIconAvatar size={mobile ? 48 : 72} icon={<UserOutlined />} style={{ flexShrink: 0 }}>
            {avatarLetter(user.username)}
          </ThemedIconAvatar>

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

      {user.role !== "superuser" ? (
        <>
          {xuiLoading && !xuiClient ? (
            <Card>
              <Flex justify="center" align="center" style={{ minHeight: 80 }}>
                <Spin indicator={<LoadingOutlined spin />} />
              </Flex>
            </Card>
          ) : null}

          {xuiClient ? <XuiSubscriptionCard client={xuiClient} /> : null}

          <Card
            title={
              <Flex align="center" gap={8}>
                <ThemedIconAvatar shape="square" size="small" icon={<DollarOutlined />} />
                <span>Новый счет</span>
              </Flex>
            }
          >
            <Text type="secondary">Создайте новый счет для оплаты подписки</Text>
            <Form id="profile-payment-form" form={paymentForm} layout="inline" onFinish={onCreatePayment} style={{ marginTop: 16 }}>
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
                    Создать и оплатить
                  </Button>
                  {statusLoading ? <Spin indicator={<LoadingOutlined spin />} /> : null}
                </Space>
              </Form.Item>
            </Form>
          </Card>

          <Card
            title={
              <Flex align="center" gap={8}>
                <ThemedIconAvatar shape="square" size="small" icon={<FileOutlined />} />
                <span>Мои счета</span>
              </Flex>
            }
            extra={
              <Button icon={<ReloadOutlined />} loading={profileLoading} onClick={() => void loadProfile()}>
                Обновить
              </Button>
            }
          >
            <Text type="secondary">Здесь вы можете посмотреть свои оплаченные или отмененные счета, а так же оплатить новый счет</Text>
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
