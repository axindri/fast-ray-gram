import { useCallback, useEffect, useState } from "react";
import { LinkOutlined, LoadingOutlined, ReloadOutlined } from "@ant-design/icons";
import { App, Badge, Button, Card, Col, Row, Space, Spin, Typography } from "antd";

import { fetchAdminLinks, fetchStatus } from "../api";
import { ADMIN_LINKS_META, getStatusServices, type AdminLinks, type StatusResponse } from "../types";

const { Title, Link, Text } = Typography;

function statusColor(status: string) {
  if (status === "ok") return "success";
  if (status === "error") return "error";
  return "warning";
}

export function MonitoringPage() {
  const { message } = App.useApp();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [links, setLinks] = useState<AdminLinks | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    await Promise.all([
      fetchStatus()
        .then(setStatus)
        .catch(() => {
          setStatus(null);
          message.error("Не удалось загрузить статус сервисов");
        }),
      fetchAdminLinks()
        .then(setLinks)
        .catch(() => {
          setLinks(null);
          message.error("Не удалось загрузить ссылки на панели");
        }),
    ]);

    setLoading(false);
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Title level={3} style={{ marginTop: 0 }}>
        Мониторинг
      </Title>

      <Row gutter={[16, 16]} justify="space-between" align="top">
        <Col xs={24} lg={12}>
          <Card
            title="Статус"
            extra={[
              <Button key="refresh" icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
                Обновить
              </Button>,
            ]}
          >
            {status ? (
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {getStatusServices(status).map(([name, item]) => (
                  <Space key={name}>
                    <Badge status={statusColor(item.status)} />
                    <Text strong>{name}</Text>
                    {item.status === "ok" ? <Text type="secondary">{item.version ? ` · v${item.version}` : ""}</Text> : null}
                  </Space>
                ))}
              </Space>
            ) : null}
            {!status && loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <Spin indicator={<LoadingOutlined spin />} size="large" />
              </div>
            ) : null}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Ссылки">
            {links ? (
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {ADMIN_LINKS_META.map(({ key, title, hint }) => (
                  <Space key={key} orientation="vertical" size={0}>
                    <Text strong>{title}</Text>
                    <Text type="secondary">{hint}</Text>
                    <Link href={links[key]} target="_blank">
                      <LinkOutlined /> {links[key]}
                    </Link>
                  </Space>
                ))}
              </Space>
            ) : null}
            {!links && loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <Spin indicator={<LoadingOutlined spin />} size="large" />
              </div>
            ) : null}
          </Card>
        </Col>
      </Row>
    </>
  );
}
