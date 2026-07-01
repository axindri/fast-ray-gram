import { useCallback, useEffect, useState } from "react";
import { LinkOutlined } from "@ant-design/icons";
import { Alert, Badge, Button, Card, Col, Row, Space, Typography } from "antd";

import { fetchAdminLinks, fetchStatus } from "../api";
import { ADMIN_LINKS_META, getStatusServices, type AdminLinks, type StatusResponse } from "../types";

const { Title, Link, Text } = Typography;

function statusColor(status: string) {
  if (status === "ok") return "success";
  if (status === "error") return "error";
  return "warning";
}

export function MonitoringPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [links, setLinks] = useState<AdminLinks | null>(null);
  const [statusError, setStatusError] = useState("");
  const [linksError, setLinksError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setStatusError("");
    setLinksError("");

    await Promise.all([
      fetchStatus()
        .then(setStatus)
        .catch(() => {
          setStatus(null);
          setStatusError("Не удалось загрузить статус сервисов");
        }),
      fetchAdminLinks()
        .then(setLinks)
        .catch(() => {
          setLinks(null);
          setLinksError("Не удалось загрузить ссылки на панели");
        }),
    ]);

    setLoading(false);
  }, []);

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
              <Button key="refresh" onClick={() => void load()} loading={loading}>
                Обновить
              </Button>,
            ]}
          >
            {statusError ? <Alert type="error" title={statusError} showIcon /> : null}
            {!statusError && status ? (
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {getStatusServices(status).map(([name, item]) => (
                  <Space key={name}>
                    <Badge status={statusColor(item.status)} />
                    <Text strong>{name}</Text>
                    <Text type="secondary">
                      {item.status}
                      {item.version ? ` · v${item.version}` : ""}
                    </Text>
                  </Space>
                ))}
              </Space>
            ) : null}
            {!statusError && !status && loading ? <Text type="secondary">Загружаю...</Text> : null}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Ссылки">
            {linksError ? <Alert type="error" title={linksError} showIcon /> : null}
            {!linksError && links ? (
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
            {!linksError && !links && loading ? <Text type="secondary">Загружаю...</Text> : null}
          </Card>
        </Col>
      </Row>
    </>
  );
}
