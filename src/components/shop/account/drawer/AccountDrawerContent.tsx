import type { FormEvent } from "react";
import { AccountForgotStep } from "@/components/shop/account/drawer/steps/AccountForgotStep";
import { AccountLoggedStep } from "@/components/shop/account/drawer/steps/AccountLoggedStep";
import { AccountPasswordStep } from "@/components/shop/account/drawer/steps/AccountPasswordStep";
import { AccountRegisterStep } from "@/components/shop/account/drawer/steps/AccountRegisterStep";
import { AccountStartStep } from "@/components/shop/account/drawer/steps/AccountStartStep";
import type { MockAccountUser } from "@/types/account";

type AccountStep = "start" | "password" | "register" | "forgot";
type AccountStepSubmitHandler = (event: FormEvent<HTMLFormElement>) => void | Promise<void>;

type AccountDrawerContentProps = {
  acceptedTerms: boolean;
  activeStep: AccountStep | "logged";
  authError?: string;
  email: string;
  forgotSent: boolean;
  isSubmitting: boolean;
  normalizedEmail: string;
  password: string;
  passwordConfirmation: string;
  passwordIsValid: boolean;
  passwordsMatch: boolean;
  submitted: boolean;
  user: MockAccountUser | null;
  onAcceptedTermsChange: (accepted: boolean) => void;
  onBackToMobileMenu: () => void;
  onClose: () => void;
  onEmailChange: (email: string) => void;
  onForgot: () => void;
  onForgotSubmit: AccountStepSubmitHandler;
  onLoginStart: () => void;
  onLoginSubmit: AccountStepSubmitHandler;
  onPasswordChange: (password: string) => void;
  onPasswordConfirmationChange: (password: string) => void;
  onRegisterStart: () => void;
  onRegisterSubmit: AccountStepSubmitHandler;
  onStepChange: (step: AccountStep) => void;
  onLogout: () => void;
};

export function AccountDrawerContent({
  acceptedTerms,
  activeStep,
  authError,
  email,
  forgotSent,
  isSubmitting,
  normalizedEmail,
  password,
  passwordConfirmation,
  passwordIsValid,
  passwordsMatch,
  submitted,
  user,
  onAcceptedTermsChange,
  onBackToMobileMenu,
  onClose,
  onEmailChange,
  onForgot,
  onForgotSubmit,
  onLoginStart,
  onLoginSubmit,
  onLogout,
  onPasswordChange,
  onPasswordConfirmationChange,
  onRegisterStart,
  onRegisterSubmit,
  onStepChange,
}: AccountDrawerContentProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
      {activeStep === "start" ? (
        <AccountStartStep
          acceptedTerms={acceptedTerms}
          email={email}
          onAcceptedTermsChange={onAcceptedTermsChange}
          onBackToMobileMenu={onBackToMobileMenu}
          onClose={onClose}
          onEmailChange={onEmailChange}
          onLogin={onLoginStart}
          onRegister={onRegisterStart}
          submitted={submitted}
        />
      ) : null}

      {activeStep === "password" ? (
        <AccountPasswordStep
          normalizedEmail={normalizedEmail}
          error={authError}
          isSubmitting={isSubmitting}
          onForgot={onForgot}
          onPasswordChange={onPasswordChange}
          onSubmit={onLoginSubmit}
          password={password}
          passwordIsValid={passwordIsValid}
          submitted={submitted}
        />
      ) : null}

      {activeStep === "register" ? (
        <AccountRegisterStep
          normalizedEmail={normalizedEmail}
          error={authError}
          isSubmitting={isSubmitting}
          onPasswordChange={onPasswordChange}
          onPasswordConfirmationChange={onPasswordConfirmationChange}
          onSubmit={onRegisterSubmit}
          password={password}
          passwordIsValid={passwordIsValid}
          passwordConfirmation={passwordConfirmation}
          passwordsMatch={passwordsMatch}
          submitted={submitted}
        />
      ) : null}

      {activeStep === "forgot" ? (
        <AccountForgotStep
          normalizedEmail={normalizedEmail}
          email={email}
          error={authError}
          forgotSent={forgotSent}
          isSubmitting={isSubmitting}
          onBackToPassword={() => onStepChange("password")}
          onClose={onClose}
          onEmailChange={onEmailChange}
          onSubmit={onForgotSubmit}
          submitted={submitted}
        />
      ) : null}

      {activeStep === "logged" && user ? (
        <AccountLoggedStep onClose={onClose} onLogout={onLogout} user={user} />
      ) : null}
    </div>
  );
}
