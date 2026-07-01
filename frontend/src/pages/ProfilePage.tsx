import { AppstoreOutlined, DollarOutlined, FileOutlined, LoadingOutlined, ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Form, InputNumber, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { createInvoice, fetchConfig, fetchXuiMe, canRenewSubscription } from "../api";
import { AsyncListState } from "../components/AsyncListState";
import { InvoiceCard } from "../components/InvoiceCard";
import { SectionCard } from "../components/SectionCard";
import { ThemedIconAvatar } from "../components/ThemedIconAvatar";
import { XuiClientCard } from "../components/XuiClientCard";
import { filterNavItems } from "../config/navigation";
import { useAuth } from "../auth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useServiceStatus } from "../hooks/useServiceStatus";
import { getApiErrorMessage } from "../utils/apiError";
import { avatarLetter, displayName } from "../utils/format";
import { ROLE_LABELS, type UserRole } from "../types";

const { Title, Text } = Typography;

function AvailableSectionsCard({ role }: { role: UserRole }) {
  const sections = useMemo(() => filterNavItems(role, { excludePaths: ["/profile"] }), [role]);

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
        {sections.map(({ path, label, hint, Icon }) => (
          <Link key={path} to={path} style={{ display: "block", color: "inherit" }}>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <Flex align="center" gap={12}>
                <ThemedIconAvatar shape="square" size="small" icon={<Icon />} />
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
  const [xuiClient, setXuiClient] = useState<Awaited<ReturnType<typeof fetchXuiMe>> | null>(null);
  const [xuiLoading, setXuiLoading] = useState(false);
  const mobile = useMediaQuery("(max-width: 991.98px)");

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
  const canRenew = xuiClient ? canRenewSubscription(xuiClient.expiry_datetime) : false;

  const onCreatePayment = async (values: PaymentForm) => {
    if (paymentsDisabled || !canRenew) {
      return;
    }

    setPaymentLoading(true);

    try {
      const invoice = await createInvoice(values.amount);
      window.open(invoice.confirmation_url, "_blank", "noopener,noreferrer");
      await refreshUser();
      message.success("Счёт создан, открыта страница оплаты");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Не удалось создать платёж"));
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

          {xuiClient ? <XuiClientCard client={xuiClient} variant="profile" /> : null}

          {canRenew ? (
            <SectionCard
              title={
                <Flex align="center" gap={8}>
                  <ThemedIconAvatar shape="square" size="small" icon={<DollarOutlined />} />
                  <span>Новый счет</span>
                </Flex>
              }
              hint="Создайте новый счет для оплаты подписки"
            >
              <Form id="profile-payment-form" form={paymentForm} layout="inline" onFinish={onCreatePayment}>
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
            </SectionCard>
          ) : null}

          <SectionCard
            title={
              <Flex align="center" gap={8}>
                <ThemedIconAvatar shape="square" size="small" icon={<FileOutlined />} />
                <span>Мои счета</span>
              </Flex>
            }
            hint="Здесь вы можете посмотреть свои оплаченные или отмененные счета, а так же оплатить новый счет"
            extra={
              <Button icon={<ReloadOutlined />} loading={profileLoading} onClick={() => void loadProfile()}>
                Обновить
              </Button>
            }
          >
            <AsyncListState loading={profileLoading} empty={!invoices.length} emptyDescription="Счетов пока нет">
              {invoices.map((item) => (
                <InvoiceCard key={item.id} item={item} variant="profile" paymentBlocked={paymentsDisabled} canRenew={canRenew} />
              ))}
            </AsyncListState>
          </SectionCard>
          <AvailableSectionsCard role={user.role} />
        </>
      ) : (
        <AvailableSectionsCard role={user.role} />
      )}
    </Space>
  );
}
