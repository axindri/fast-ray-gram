import { ProfileResultPage } from "../components/ProfileResultPage";

export function PaymentSuccessPage() {
  return (
    <ProfileResultPage
      status="success"
      title="Оплата прошла успешно. Нужно еще немного времени на обработу платежа в нашей системе, пожалуйста, подождите."
    />
  );
}
