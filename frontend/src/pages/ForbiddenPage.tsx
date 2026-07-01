import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="Доступ запрещён"
      subTitle="У вас нет прав для просмотра этой страницы."
      extra={
        <Link to="/profile">
          <Button type="primary">Перейти в профиль</Button>
        </Link>
      }
    />
  );
}
