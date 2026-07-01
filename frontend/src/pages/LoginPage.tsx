import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Typography } from "antd";

import { useAuth } from "../auth";

const { Title } = Typography;

type LoginForm = {
  token: string;
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    setError("");

    try {
      await login(values.token);
      navigate("/profile", { replace: true });
    } catch {
      setError("Неверный токен");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "64px 16px 24px", boxSizing: "border-box" }}>
      <Title level={3} style={{ textAlign: "center" }}>
        Fast Ray Gram
      </Title>

      <Card style={{ maxWidth: 400, width: "100%", margin: "0 auto" }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Токен" name="token" rules={[{ required: true, message: "Введите токен" }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          {error ? <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} /> : null}

          <Button type="primary" htmlType="submit" loading={loading} block>
            Войти
          </Button>
        </Form>
      </Card>
    </main>
  );
}
