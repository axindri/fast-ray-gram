import { useEffect, useState } from "react";
import { Alert } from "antd";

import { fetchStatus } from "../api";
import { getUnavailableServiceNames } from "../types";

const CONTACT_MESSAGE = "По всем вопросам обращайтесь к администратору или в личные сообщения группы.";

export function ServiceStatusBanner() {
  const [warning, setWarning] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    fetchStatus()
      .then((status) => {
        const unavailable = getUnavailableServiceNames(status);
        if (unavailable.length === 0) {
          setWarning(null);
          return;
        }

        setWarning({
          title: `Некоторые сервисы временно недоступны`,
          description: "Платежи отключены до восстановления работоспособности. " + CONTACT_MESSAGE,
        });
      })
      .catch(() => {
        setWarning({
          title: `Не удалось проверить статус сервисов`,
          description: "Платежи отключены до восстановления работоспособности. " + CONTACT_MESSAGE,
        });
      });
  }, []);

  if (!warning) {
    return null;
  }

  return <Alert type="warning" title={warning.title} description={warning.description} banner showIcon style={{ padding: 12 }} />;
}
