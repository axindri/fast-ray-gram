import { useCallback, useEffect, useState } from "react";
import { LoadingOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Empty, Form, InputNumber, Row, Space, Spin, Tag, Typography } from "antd";

import { cancelInvoice, checkInvoices, fetchInvoices, formatDate } from "../api";
import { INVOICE_STATUS_LABELS, invoiceStatusColor, type AdminInvoice, type Invoice, type Paginated } from "../types";
import { copyToClipboard } from "../utils/clipboard";

const { Title, Text, Link } = Typography;

function InvoiceRow({ item, admin = false }: { item: Invoice | AdminInvoice; admin?: boolean }) {
  const { message } = App.useApp();
  const adminItem = admin ? (item as AdminInvoice) : null;
  const status = String(item.status || "").toLowerCase();

  return (
    <Card size="small" title={`#${item.invoice_id}`} extra={<Tag color={invoiceStatusColor(status)}>{INVOICE_STATUS_LABELS[status] || status || "—"}</Tag>}>
      <Space orientation="vertical" size={4} style={{ width: "100%" }}>
        {adminItem ? (
          <>
            <Text
              type="secondary"
              style={{ cursor: "pointer" }}
              onClick={() => {
                void copyToClipboard(String(adminItem.id))
                  .then(() => message.success("Скопировано"))
                  .catch(() => message.error("Не удалось скопировать"));
              }}
            >
              Идентификатор (ID): {adminItem.id}
            </Text>
            <Text type="secondary">Пользователь: {adminItem.username || `ID ${adminItem.user_id}`}</Text>
            {adminItem.mark ? <Text type="secondary">Заметка: {adminItem.mark}</Text> : null}
            {adminItem.sub_url ? (
              <Link href={adminItem.sub_url} target="_blank">
                Ссылка подписки
              </Link>
            ) : null}
            <Text type="secondary">Сумма: {adminItem.amount} ₽ ·</Text>
          </>
        ) : null}
        <Text type="secondary">Создан: {formatDate(item.created_at)}</Text>
      </Space>
    </Card>
  );
}

const emptyPagination = (): Paginated<AdminInvoice> => ({
  items: [],
  total: 0,
  page: 1,
  limit: 3,
  pages: 1,
});

export function PaymentsPage() {
  const { message } = App.useApp();
  const [checkedInvoices, setCheckedInvoices] = useState<Invoice[] | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const [allInvoices, setAllInvoices] = useState<Paginated<AdminInvoice>>(emptyPagination);
  const [allLoading, setAllLoading] = useState(false);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelForm] = Form.useForm<{ id: number }>();

  const loadAllInvoices = useCallback(
    async (page: number) => {
      setAllLoading(true);

      try {
        const data = await fetchInvoices(page, allInvoices.limit);
        setAllInvoices(data);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "Не удалось загрузить инвойсы");
      } finally {
        setAllLoading(false);
      }
    },
    [allInvoices.limit, message],
  );

  useEffect(() => {
    void loadAllInvoices(1);
  }, [loadAllInvoices]);

  const onCheck = async () => {
    setCheckLoading(true);

    try {
      const items = await checkInvoices();
      setCheckedInvoices(items);
      await loadAllInvoices(allInvoices.page);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось проверить инвойсы");
    } finally {
      setCheckLoading(false);
    }
  };

  const onCancel = async (values: { id: number }) => {
    setCancelLoading(true);

    try {
      const invoice = await cancelInvoice(values.id);
      message.success(`Инвойс #${invoice.invoice_id} отменён`);
      cancelForm.resetFields();
      await loadAllInvoices(allInvoices.page);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Не удалось отменить инвойс");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      <Title level={3} style={{ marginTop: 0 }}>
        Платежи
      </Title>

      <Row gutter={[16, 16]} align="top">
        <Col xs={24} xl={12}>
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Card
              title="Оплаченные инвойсы"
              extra={[
                <Button key="refresh" type="primary" onClick={onCheck} loading={checkLoading}>
                  Проверить
                </Button>,
              ]}
            >
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {checkedInvoices === null ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Проверка ещё не запускалась" />
                ) : checkedInvoices.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Новых оплаченных инвойсов нет" />
                ) : (
                  checkedInvoices.map((item) => <InvoiceRow key={item.id} item={item} />)
                )}
              </Space>
            </Card>

            <Card title="Отменить инвойс">
              <Text type="secondary">Принудительно перевести инвойс в статус «Отменён».</Text>
              <Form id="cancel-invoice-form" form={cancelForm} layout="vertical" onFinish={onCancel} style={{ marginTop: 16, marginBottom: 0 }}>
                <Form.Item label="ID записи" style={{ marginBottom: 0 }}>
                  <Space.Compact block>
                    <Form.Item name="id" noStyle rules={[{ required: true, message: "Введите ID" }]}>
                      <InputNumber placeholder="1" style={{ width: "100%" }} />
                    </Form.Item>
                    <Button danger htmlType="submit" loading={cancelLoading}>
                      Отменить
                    </Button>
                  </Space.Compact>
                </Form.Item>
              </Form>
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Все инвойсы"
            extra={
              <Button key="refresh" icon={<ReloadOutlined />} onClick={() => void loadAllInvoices(1)} loading={allLoading}>
                Обновить
              </Button>
            }
          >
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              {allLoading && !allInvoices.items.length ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                  <Spin indicator={<LoadingOutlined spin />} size="large" />
                </div>
              ) : null}

              {!allLoading && !allInvoices.items.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Инвойсов нет" /> : null}

              {allInvoices.items.map((item) => (
                <InvoiceRow key={item.id} item={item} admin />
              ))}

              {allInvoices.total > 0 ? (
                <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
                  <Text type="secondary">
                    Страница {allInvoices.page} из {allInvoices.pages} · всего {allInvoices.total}
                  </Text>
                  <Space>
                    <Button disabled={allInvoices.page <= 1 || allLoading} onClick={() => void loadAllInvoices(allInvoices.page - 1)}>
                      Назад
                    </Button>
                    <Button disabled={allInvoices.page >= allInvoices.pages || allLoading} onClick={() => void loadAllInvoices(allInvoices.page + 1)}>
                      Вперёд
                    </Button>
                  </Space>
                </Space>
              ) : null}
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}
