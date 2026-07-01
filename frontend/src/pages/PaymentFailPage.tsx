import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export function PaymentFailPage() {
  return (
    <Result
      status="error"
      title="Нет успешной оплаты"
      subTitle="Если возникли трудности или что-то пошло не так, пожалуйста, обратитесь к администратору или в личные сообщения группы."
      extra={
        <Link to="/profile">
          <Button type="primary">Перейти в профиль</Button>
        </Link>
      }
    />
  );
}
