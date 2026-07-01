import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export function PaymentSuccessPage() {
  return (
    <Result
      status="success"
      title="Оплата прошла успешно. Нужно еще немного времени на обработу платежа в нашей системе, пожалуйста, подождите."
      extra={
        <Link to="/profile">
          <Button type="primary">Перейти в профиль</Button>
        </Link>
      }
    />
  );
}
