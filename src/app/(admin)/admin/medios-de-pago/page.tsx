import { PaymentMethodsClient } from "@/components/admin/payment-methods/PaymentMethodsClient";
import { getPaymentProviderDefinitions } from "@/lib/data/admin/payment-methods";

export default async function PaymentMethodsPage() {
  const providers = await getPaymentProviderDefinitions();

  return <PaymentMethodsClient providers={providers} />;
}
