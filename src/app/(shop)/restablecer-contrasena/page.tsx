import { Suspense } from "react";
import {
  ResetPasswordForm,
  ResetPasswordFormFallback,
} from "@/components/shop/account/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFormFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
