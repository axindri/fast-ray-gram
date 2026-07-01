import { useCallback, useEffect, useMemo, useState } from "react";
import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Empty, Flex, Form, Input, InputNumber, Popconfirm, Row, Select, Space, Spin, Tag, Typography } from "antd";

import {
  buildAuthLink,
  createUser,
  deleteUser,
  deleteXuiClient,
  fetchConfig,
  fetchUserById,
  fetchUsers,
  fetchXuiClient,
  formatDate,
  refreshUserToken,
  resetXuiClientTraffic,
  updateXuiClient,
} from "../api";
import { useAuth } from "../auth";
import { ROLE_LABELS, type AdminUser, type Paginated, type UserRole, type XuiClient } from "../types";
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

type UserGetForm = { id: number };

type UserRefreshForm = { id: number };

type XuiGetForm = { email: string };

type XuiUpdateForm = {
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
  if (loading) {
    return (
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">Загружаю...</Text>
      </div>
    );
  }

  if (lookup === "not_found") {
    return (
      <div style={{ marginTop: 16 }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пользователь не найден" />
      </div>
    );
  }

  if (user) {
    return (
      <div style={{ marginTop: 16 }}>
        <UserRow user={user} />
      </div>
    );
  }

  return null;
}

function UserRow({ user }: { user: AdminUser }) {
  return (
    <Card size="small" title={user.username} extra={<Tag color="blue">{ROLE_LABELS[user.role]}</Tag>}>
      <Space orientation="vertical" size={4} style={{ width: "100%" }}>
        <Text type="secondary">ID: {user.id}</Text>
        {user.mark ? <Text type="secondary">Заметка: {user.mark}</Text> : <Text type="secondary">-</Text>}
        {user.sub_url ? (
          <Link href={user.sub_url} target="_blank">
            Ссылка подписки
          </Link>
        ) : null}
      </Space>
    </Card>
  );
}

const emptyUsersPagination = (): Paginated<AdminUser> => ({
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  pages: 1,
});

function formatTraffic(usedBytes: number, totalGb: number): string {
  const usedGb = (usedBytes / 1024 ** 3).toFixed(2);

  if (!totalGb) {
    return `${usedGb} GB / без лимита`;
  }

  return `${usedGb} / ${totalGb} GB`;
}

function XuiClientDetails({ client }: { client: XuiClient }) {
  const { message } = App.useApp();

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <span>{client.email}</span>
        </Flex>
      }
      extra={
        <Tag color={client.enable ? "green" : "red"} style={{ marginInlineStart: 4 }}>
          {client.enable ? "Включён" : "Выключен"}
        </Tag>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        <Text>
          Трафик: <Text strong>{formatTraffic(client.used_traffic, client.total_gb)}</Text>
        </Text>
        <Text>Действует до: {formatDate(client.expiry_datetime)}</Text>

        {client.sub_url ? (
          <div style={{ marginTop: 12 }}>
            <Text style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Ссылка подписки</Text>

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

export function UsersPage() {
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();
  const [defaultExpiryDays, setDefaultExpiryDays] = useState(30);

  const [createLoading, setCreateLoading] = useState(false);
  const [createdAuthLink, setCreatedAuthLink] = useState("");
  const [createForm] = Form.useForm<CreateUserForm>();

  const [userGetLoading, setUserGetLoading] = useState(false);
  const [userRefreshLoading, setUserRefreshLoading] = useState(false);
  const [managedUser, setManagedUser] = useState<AdminUser | null>(null);
  const [userLookup, setUserLookup] = useState<UserLookupState>("idle");
  const [authLink, setAuthLink] = useState("");
  const [userGetForm] = Form.useForm<UserGetForm>();
  const [userRefreshForm] = Form.useForm<UserRefreshForm>();

  const [xuiGetLoading, setXuiGetLoading] = useState(false);
  const [xuiUpdateLoading, setXuiUpdateLoading] = useState(false);
  const [xuiClient, setXuiClient] = useState<XuiClient | null>(null);
  const [xuiGetForm] = Form.useForm<XuiGetForm>();
  const [xuiUpdateForm] = Form.useForm<XuiUpdateForm>();

  const [allUsers, setAllUsers] = useState<Paginated<AdminUser>>(emptyUsersPagination);
  const [allUsersLoading, setAllUsersLoading] = useState(false);

  const loadAllUsers = useCallback(
    async (page: number) => {
      setAllUsersLoading(true);

      try {
        const data = await fetchUsers(page, allUsers.limit);
        setAllUsers(data);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "Не удалось загрузить пользователей");
      } finally {
        setAllUsersLoading(false);
      }
    },
    [allUsers.limit, message],
  );

  useEffect(() => {
    void loadAllUsers(1);
  }, [loadAllUsers]);

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
        xuiUpdateForm.setFieldValue("expiry_time_days", config.default_expiry_time_days);
      })
      .catch(() => undefined);
  }, [createForm, xuiUpdateForm]);

  const onCreateUser = async (values: CreateUserForm) => {
    setCreateLoading(true);
    setCreatedAuthLink("");

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
      setCreatedAuthLink(buildAuthLink(token));
      message.success("Пользователь создан");
      await loadAllUsers(1);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось создать пользователя");
    } finally {
      setCreateLoading(false);
    }
  };

  const runUserGetAction = async (action: "get" | "delete") => {
    const { id } = await userGetForm.validateFields();
    setUserGetLoading(true);

    if (action === "get") {
      setManagedUser(null);
      setUserLookup("idle");
    }

    try {
      if (action === "get") {
        const user = await fetchUserById(id);
        setManagedUser(user);
        setUserLookup("found");
        return;
      }

      await deleteUser(id);
      setManagedUser(null);
      setUserLookup("idle");
      message.success("Пользователь удалён");
      await loadAllUsers(allUsers.page);
    } catch (error) {
      if (action === "get") {
        setManagedUser(null);
        setUserLookup("not_found");
      }
      message.error(error instanceof Error ? error.message : "Не удалось выполнить действие");
    } finally {
      setUserGetLoading(false);
    }
  };

  const runUserRefreshAction = async () => {
    const { id } = await userRefreshForm.validateFields();
    setUserRefreshLoading(true);
    setAuthLink("");

    try {
      const token = await refreshUserToken(id);
      setAuthLink(buildAuthLink(token));
      message.success("Токен обновлён");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось выполнить действие");
    } finally {
      setUserRefreshLoading(false);
    }
  };

  const runXuiGetAction = async (action: "get" | "delete") => {
    const { email } = await xuiGetForm.validateFields();
    setXuiGetLoading(true);

    if (action === "get") {
      setXuiClient(null);
    }

    try {
      if (action === "get") {
        const client = await fetchXuiClient(email);
        setXuiClient(client);
        return;
      }

      await deleteXuiClient(email);
      setXuiClient(null);
      message.success("Клиент удалён");
    } catch (error) {
      if (action === "get") {
        setXuiClient(null);
      }
      message.error(error instanceof Error ? error.message : "Не удалось выполнить действие");
    } finally {
      setXuiGetLoading(false);
    }
  };

  const runXuiUpdateAction = async (action: "update" | "reset") => {
    const values = await xuiUpdateForm.validateFields();
    setXuiUpdateLoading(true);

    try {
      if (action === "update") {
        await updateXuiClient(values.email, {
          expiry_time_days: values.expiry_time_days ?? defaultExpiryDays,
          enable: values.enable,
        });
        message.success("Клиент обновлён");
        return;
      }

      await resetXuiClientTraffic(values.email);
      message.success("Трафик сброшен");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось выполнить действие");
    } finally {
      setXuiUpdateLoading(false);
    }
  };

  return (
    <>
      <Title level={3} style={{ marginTop: 0 }}>
        Пользователи
      </Title>

      <Row gutter={[16, 16]} align="top" style={{ width: "100%" }}>
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

              {createdAuthLink ? <CopyField label="Ссылка для входа" value={createdAuthLink} /> : null}
            </Card>

            <Card title="Получить пользователя">
              <Text type="secondary">Просмотр данных пользователя и удаление</Text>
              <Form form={userGetForm} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item label="User ID" name="id" rules={[{ required: true, message: "Введите ID" }]}>
                  <InputNumber style={{ width: "100%" }} placeholder="1" />
                </Form.Item>

                <Space wrap>
                  <Button loading={userGetLoading} onClick={() => void runUserGetAction("get")}>
                    Получить
                  </Button>
                  <Popconfirm title="Удалить пользователя?" okText="Да" cancelText="Нет" okButtonProps={{ danger: true }} onConfirm={() => void runUserGetAction("delete")}>
                    <Button danger loading={userGetLoading}>
                      Удалить
                    </Button>
                  </Popconfirm>
                </Space>

                <UserLookupPanel loading={userGetLoading} lookup={userLookup} user={managedUser} />
              </Form>
            </Card>

            <Card title="Новая ссылка для входа">
              <Text type="secondary">Генерация новой ссылки для входа пользователя</Text>
              <Form form={userRefreshForm} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item label="User ID" name="id" rules={[{ required: true, message: "Введите ID" }]}>
                  <InputNumber style={{ width: "100%" }} placeholder="1" />
                </Form.Item>

                <Button type="primary" loading={userRefreshLoading} onClick={() => void runUserRefreshAction()}>
                  Получить
                </Button>

                {authLink ? (
                  <div style={{ marginTop: 16 }}>
                    <CopyField label="Ссылка для входа" value={authLink} />
                  </div>
                ) : null}
              </Form>
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={12}>
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Card title="Просмотр XUI клиента">
              <Text type="secondary">Просмотр данных клиента и удаление</Text>
              <Form form={xuiGetForm} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item label="Username" name="email" rules={[{ required: true, message: "Введите имя пользователя" }]}>
                  <Input placeholder="Alex" />
                </Form.Item>

                <Space wrap>
                  <Button loading={xuiGetLoading} onClick={() => void runXuiGetAction("get")}>
                    Получить
                  </Button>
                  <Popconfirm title="Удалить XUI-клиента?" okText="Да" cancelText="Нет" okButtonProps={{ danger: true }} onConfirm={() => void runXuiGetAction("delete")}>
                    <Button danger loading={xuiGetLoading}>
                      Удалить
                    </Button>
                  </Popconfirm>
                </Space>

                {xuiClient ? (
                  <div style={{ marginTop: 16 }}>
                    <XuiClientDetails client={xuiClient} />
                  </div>
                ) : null}
              </Form>
            </Card>

            <Card title="Обновить XUI клиента">
              <Text type="secondary">Срок действия, статус и сброс трафика</Text>
              <Form form={xuiUpdateForm} layout="vertical" initialValues={{ enable: true }} style={{ marginTop: 16 }}>
                <Form.Item label="Username" name="email" rules={[{ required: true, message: "Введите имя пользователя" }]}>
                  <Input placeholder="Alex" />
                </Form.Item>

                <Row gutter={12}>
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

                <Space wrap>
                  <Button type="primary" loading={xuiUpdateLoading} onClick={() => void runXuiUpdateAction("update")}>
                    Обновить
                  </Button>
                  <Button loading={xuiUpdateLoading} onClick={() => void runXuiUpdateAction("reset")}>
                    Сбросить трафик
                  </Button>
                </Space>
              </Form>
            </Card>

            <Card
              title="Все пользователи"
              extra={
                <Button icon={<ReloadOutlined />} onClick={() => void loadAllUsers(allUsers.page)} loading={allUsersLoading}>
                  Обновить
                </Button>
              }
            >
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {allUsersLoading && !allUsers.items.length ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                    <Spin size="large" />
                  </div>
                ) : null}

                {!allUsersLoading && !allUsers.items.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пользователей нет" /> : null}

                {allUsers.items.map((item) => (
                  <UserRow key={item.id} user={item} />
                ))}

                {allUsers.total > 0 ? (
                  <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
                    <Text type="secondary">
                      Страница {allUsers.page} из {allUsers.pages} · всего {allUsers.total}
                    </Text>
                    <Space>
                      <Button disabled={allUsers.page <= 1 || allUsersLoading} onClick={() => void loadAllUsers(allUsers.page - 1)}>
                        Назад
                      </Button>
                      <Button disabled={allUsers.page >= allUsers.pages || allUsersLoading} onClick={() => void loadAllUsers(allUsers.page + 1)}>
                        Вперёд
                      </Button>
                    </Space>
                  </Space>
                ) : null}
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}
