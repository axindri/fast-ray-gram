import { WifiOutlined } from "@ant-design/icons";
import { Card, Flex, Space, Tag, Typography } from "antd";

import { formatDate, formatExpiryRemaining } from "../api";
import { HintTooltip } from "./HintTooltip";
import { ThemedIconAvatar } from "./ThemedIconAvatar";
import { CopyableInput } from "./CopyableInput";
import { formatLimitIps, formatTraffic } from "../utils/format";
import type { XuiClient } from "../types";

const { Text } = Typography;

const LIMIT_IP_HINT =
  "Лимит IP — это не число устройств. С одного IP могут подключаться несколько устройств. Ограничение действует на количество разных IP-адресов одновременно.";

type XuiClientCardProps = {
  client: XuiClient;
  variant?: "admin" | "profile";
};

const TAG_LABELS = {
  admin: { enabled: "Включён", disabled: "Выключен" },
  profile: { enabled: "Включена", disabled: "Выключена" },
} as const;

const SUB_URL_HINTS = {
  admin: "Ссылка подписки",
  profile: "Добавьте ссылку в VPN-клиент для подключения",
} as const;

function CardTitle({ variant, email }: { variant: "admin" | "profile"; email: string }) {
  if (variant === "admin") {
    return <span>{email}</span>;
  }

  return (
    <Flex align="center" gap={8}>
      <ThemedIconAvatar shape="square" size="small" icon={<WifiOutlined />} />
      <span>Подписка</span>
    </Flex>
  );
}

export function XuiClientCard({ client, variant = "admin" }: XuiClientCardProps) {
  const expiryRemaining = formatExpiryRemaining(client.expiry_datetime);
  const tagLabels = TAG_LABELS[variant];

  return (
    <Card
      title={<CardTitle variant={variant} email={client.email} />}
      extra={
        <Tag color={client.enable ? "green" : "red"} style={{ marginInlineStart: 4 }}>
          {client.enable ? tagLabels.enabled : tagLabels.disabled}
        </Tag>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        <Text>
          Трафик: <Text strong>{formatTraffic(client.used_traffic, client.total_gb)}</Text>
        </Text>
        {variant === "profile" ? (
          <Flex align="center" gap={6} wrap>
            <Text>
              Лимит IP: <Text strong>{formatLimitIps(client.limit_ips)}</Text>
            </Text>
            <HintTooltip title={LIMIT_IP_HINT} />
          </Flex>
        ) : null}
        <Text>
          Действует до: {formatDate(client.expiry_datetime)}
          {expiryRemaining ? ` · ${expiryRemaining}` : null}
        </Text>

        {client.sub_url ? (
          <div style={{ marginTop: 12 }}>
            <SubUrlBlock hint={SUB_URL_HINTS[variant]} subUrl={client.sub_url} />
          </div>
        ) : null}
      </Space>
    </Card>
  );
}

function SubUrlBlock({ hint, subUrl }: { hint: string; subUrl: string }) {
  return (
    <>
      <Text style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>{hint}</Text>
      <CopyableInput value={subUrl} buttonVariant="icon" />
    </>
  );
}
