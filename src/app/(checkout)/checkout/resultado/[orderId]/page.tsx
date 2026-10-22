import { PaymentResult } from "@/components/checkout/PaymentResult";

export default async function CheckoutResultPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  return <PaymentResult orderId={orderId} />;
}
