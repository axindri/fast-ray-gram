import { useEffect, useMemo, useState } from "react";
import { App, Button, Card, Col, Empty, Form, Input, InputNumber, Popconfirm, Row, Select, Space, Typography } from "antd";

import { buildAuthLink, createUser, deleteUser, deleteXuiClient, fetchConfig, fetchUserById, fetchXuiClient, formatDate, refreshUserToken, resetXuiClientTraffic, updateXuiClient } from "../api";
import { useAuth } from "../auth";
import { ROLE_LABELS, type AdminUser, type UserRole, type XuiClient } from "../types";
import { copyToClipboard } from "../utils/clipboard";

const { Title, Text, Link } = Typography;

type CreateUserForm = {
  username: string;
  role: UserRole;
  mark?: string;
  flow?: string;
  limit_ips?: number;
  total_gb?: number;
  expiry_time_days?: number;
};

type UserActionForm = { id: number };

type XuiForm = {
  email: string;
  expiry_time_days?: number;
  enable: boolean;
};

function CopyField({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  const { message } = App.useApp();

  return (
    <Space orientation="vertical" size={4} style={{ width: "100%" }}>
      <Text type="secondary">{label}</Text>
      <Space.Compact style={{ width: "100%" }}>
        <Input value={value} readOnly style={highlight ? { fontWeight: 600 } : undefined} />
        <Button
          onClick={() => {
            void copyToClipboard(value)
              .then(() => message.success("Скопировано"))
              .catch(() => message.error("Не удалось скопировать"));
          }}
        >
          Скопировать
        </Button>
      </Space.Compact>
    </Space>
  );
}

type UserLookupState = "idle" | "found" | "not_found";

function UserLookupPanel({ loading, lookup, user }: { loading: boolean; lookup: UserLookupState; user: AdminUser | null }) {
  return (
    <Card size="small" title={"Пользователь"} style={{ height: "100%", marginTop: 16 }}>
      {loading ? <Text type="secondary">Загружаю...</Text> : null}
      {!loading && lookup === "idle" ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Введите ID и нажмите «Получить»" /> : null}
      {!loading && lookup === "not_found" ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пользователь не найден" /> : null}
      {!loading && user ? <UserDetails user={user} /> : null}
    </Card>
  );
}

function UserDetails({ user }: { user: AdminUser }) {
  return (
    <Space orientation="vertical" size={4} style={{ width: "100%" }}>
      <Text strong>{user.username}</Text>
      <Text type="secondary">
        ID: {user.id} · {ROLE_LABELS[user.role]}
      </Text>
      {user.mark ? <Text type="secondary">Заметка: {user.mark}</Text> : null}
      {user.sub_url ? (
        <Link href={user.sub_url} target="_blank">
          Ссылка подписки
        </Link>
      ) : null}
    </Space>
  );
}

function XuiClientDetails({ client }: { client: XuiClient }) {
  return (
    <Space orientation="vertical" size={4} style={{ width: "100%" }}>
      <Text strong>{client.email}</Text>
      <Text type="secondary">
        до {formatDate(client.expiry_datetime)} · {client.total_gb} GB · {client.enable ? "включён" : "выключен"}
      </Text>
      {client.sub_url ? (
        <Link href={client.sub_url} target="_blank">
          Ссылка подписки
        </Link>
      ) : null}
    </Space>
  );
}

export function UsersPage() {
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();
  const [defaultExpiryDays, setDefaultExpiryDays] = useState(30);

  const [createLoading, setCreateLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState("");
  const [createForm] = Form.useForm<CreateUserForm>();

  const [userLoading, setUserLoading] = useState(false);
  const [managedUser, setManagedUser] = useState<AdminUser | null>(null);
  const [userLookup, setUserLookup] = useState<UserLookupState>("idle");
  const [authLink, setAuthLink] = useState("");
  const [userForm] = Form.useForm<UserActionForm>();

  const [xuiLoading, setXuiLoading] = useState(false);
  const [xuiClient, setXuiClient] = useState<XuiClient | null>(null);
  const [xuiForm] = Form.useForm<XuiForm>();

  const roleOptions = useMemo(() => {
    if (currentUser?.role === "superuser") {
      return [
        { value: "user", label: ROLE_LABELS.user },
        { value: "admin", label: ROLE_LABELS.admin },
      ];
    }
    return [{ value: "user", label: ROLE_LABELS.user }];
  }, [currentUser?.role]);

  useEffect(() => {
    fetchConfig()
      .then((config) => {
        setDefaultExpiryDays(config.default_expiry_time_days);
        createForm.setFieldValue("expiry_time_days", config.default_expiry_time_days);
        xuiForm.setFieldValue("expiry_time_days", config.default_expiry_time_days);
      })
      .catch(() => undefined);
  }, [createForm, xuiForm]);

  const onCreateUser = async (values: CreateUserForm) => {
    setCreateLoading(true);
    setCreatedToken("");

    try {
      const token = await createUser({
        ...values,
        mark: values.mark || "",
        flow: values.flow || "",
        limit_ips: values.limit_ips ?? 0,
        total_gb: values.total_gb ?? 0,
        expiry_time_days: values.expiry_time_days ?? defaultExpiryDays,
        enable: true,
      });
      setCreatedToken(token);
      message.success("Пользователь создан");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось создать пользователя");
    } finally {
      setCreateLoading(false);
    }
  };

  const runUserAction = async (action: "get" | "refresh" | "delete") => {
    const { id } = await userForm.validateFields();
    setUserLoading(true);

    if (action === "get") {
      setManagedUser(null);
      setAuthLink("");
      setUserLookup("idle");
    }

    try {
      if (action === "get") {
        const user = await fetchUserById(id);
        setManagedUser(user);
        setUserLookup("found");
        return;
      }

      if (action === "refresh") {
        const token = await refreshUserToken(id);
        setAuthLink(buildAuthLink(token));
        message.success("Токен обновлён");
        return;
      }

      await deleteUser(id);
      setManagedUser(null);
      setUserLookup("idle");
      setAuthLink("");
      message.success("Пользователь удалён");
    } catch (error) {
      if (action === "get") {
        setManagedUser(null);
        setUserLookup("not_found");
      }
      message.error(error instanceof Error ? error.message : "Не удалось выполнить действие");
    } finally {
      setUserLoading(false);
    }
  };

  const runXuiAction = async (action: "get" | "reset" | "delete" | "update") => {
    const values = await xuiForm.validateFields();
    setXuiLoading(true);
    setXuiClient(null);

    try {
      if (action === "get") {
        const client = await fetchXuiClient(values.email);
        setXuiClient(client);
        return;
      }

      if (action === "update") {
        await updateXuiClient(values.email, {
          expiry_time_days: values.expiry_time_days ?? defaultExpiryDays,
          enable: values.enable,
        });
        message.success("Клиент обновлён");
        return;
      }

      if (action === "reset") {
        await resetXuiClientTraffic(values.email);
        message.success("Трафик сброшен");
        return;
      }

      await deleteXuiClient(values.email);
      message.success("Клиент удалён");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось выполнить действие");
    } finally {
      setXuiLoading(false);
    }
  };

  return (
    <>
      <Title level={3} style={{ marginTop: 0 }}>
        Пользователи
      </Title>

      <Row gutter={[16, 16]} align="top">
        <Col xs={24} xl={12}>
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Card title="Создать пользователя">
              <Text type="secondary">Будет создан пользователь и его XUI-клиент</Text>
              <Form form={createForm} layout="vertical" onFinish={onCreateUser} initialValues={{ role: "user" }} style={{ marginTop: 16 }}>
                <Form.Item label="Username" name="username" rules={[{ required: true, message: "Введите username" }]}>
                  <Input placeholder="Alex" />
                </Form.Item>

                <Form.Item label="Роль" name="role" rules={[{ required: true }]}>
                  <Select options={roleOptions} />
                </Form.Item>

                <Form.Item label="Заметка" name="mark">
                  <Input placeholder="Заметка или комментарий" />
                </Form.Item>

                <Form.Item label="Flow" name="flow">
                  <Input placeholder="xtls-rprx-vision" />
                </Form.Item>

                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Form.Item label="Лимит IP" name="limit_ips">
                      <InputNumber style={{ width: "100%" }} placeholder="0" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Объем трафика" name="total_gb">
                      <InputNumber style={{ width: "100%" }} placeholder="0" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Срок действия" name="expiry_time_days">
                      <InputNumber style={{ width: "100%" }} placeholder={String(defaultExpiryDays)} />
                    </Form.Item>
                  </Col>
                </Row>

                <Button type="primary" htmlType="submit" loading={createLoading}>
                  Создать
                </Button>
              </Form>

              {createdToken ? <CopyField label="Новый токен" value={createdToken} highlight /> : null}
            </Card>

            <Card title="Пользователь по ID">
              <Text type="secondary">Получение пользователя, обновление ссылки для входа и удаление</Text>
              <Row gutter={16} align="top" style={{ marginTop: 16 }}>
                <Col xs={24} md={12}>
                  <Form form={userForm} layout="vertical">
                    <Form.Item label="User ID" name="id" rules={[{ required: true, message: "Введите ID" }]}>
                      <InputNumber style={{ width: "100%" }} placeholder="1" />
                    </Form.Item>

                    <Space wrap>
                      <Button loading={userLoading} onClick={() => void runUserAction("get")}>
                        Получить пользователя
                      </Button>
                      <Button type="primary" loading={userLoading} onClick={() => void runUserAction("refresh")}>
                        Новая ссылка для входа
                      </Button>
                      <Popconfirm title="Удалить пользователя?" okText="Да" cancelText="Нет" okButtonProps={{ danger: true }} onConfirm={() => void runUserAction("delete")}>
                        <Button danger loading={userLoading}>
                          Удалить
                        </Button>
                      </Popconfirm>
                    </Space>

                    {authLink ? (
                      <div style={{ marginTop: 16 }}>
                        <CopyField label="Ссылка для входа" value={authLink} />
                      </div>
                    ) : null}
                  </Form>
                </Col>

                <Col xs={24} md={12}>
                  <UserLookupPanel loading={userLoading} lookup={userLookup} user={managedUser} />
                </Col>
              </Row>
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="XUI клиент">
            <Form form={xuiForm} layout="vertical" initialValues={{ enable: true }}>
              <Form.Item label="Username" name="email" rules={[{ required: true, message: "Введите имя пользователя" }]}>
                <Input placeholder="Alex" />
              </Form.Item>

              <Space wrap>
                <Button loading={xuiLoading} onClick={() => void runXuiAction("get")}>
                  Получить
                </Button>
                <Button loading={xuiLoading} onClick={() => void runXuiAction("reset")}>
                  Сбросить трафик
                </Button>
                <Popconfirm title="Удалить XUI-клиента?" okText="Да" cancelText="Нет" okButtonProps={{ danger: true }} onConfirm={() => void runXuiAction("delete")}>
                  <Button danger loading={xuiLoading}>
                    Удалить
                  </Button>
                </Popconfirm>
              </Space>

              <Row gutter={12} style={{ marginTop: 16 }}>
                <Col xs={24} md={12}>
                  <Form.Item label="Срок действия, дней" name="expiry_time_days">
                    <InputNumber style={{ width: "100%" }} placeholder={String(defaultExpiryDays)} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Включен по-умолчанию" name="enable">
                    <Select
                      options={[
                        { value: true, label: "Да" },
                        { value: false, label: "Нет" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" loading={xuiLoading} onClick={() => void runXuiAction("update")}>
                Обновить
              </Button>

              {xuiClient ? (
                <div style={{ marginTop: 16 }}>
                  <XuiClientDetails client={xuiClient} />
                </div>
              ) : null}
            </Form>
          </Card>
        </Col>
      </Row>
    </>
  );
}
