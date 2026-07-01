import { Card, Typography } from "antd";
import type { ReactNode } from "react";

const { Text } = Typography;

type SectionCardProps = {
  title: ReactNode;
  hint?: string;
  extra?: ReactNode;
  children: ReactNode;
};

export function SectionCard({ title, hint, extra, children }: SectionCardProps) {
  return (
    <Card title={title} extra={extra}>
      {hint ? <Text type="secondary">{hint}</Text> : null}
      <div style={hint ? { marginTop: 16 } : undefined}>{children}</div>
    </Card>
  );
}
