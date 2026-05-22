import type { Dispatch, SetStateAction } from "react";
import { AccountForgotStep } from "@/components/shop/account/drawer/steps/AccountForgotStep";
import { AccountLoggedStep } from "@/components/shop/account/drawer/steps/AccountLoggedStep";
import { AccountPasswordStep } from "@/components/shop/account/drawer/steps/AccountPasswordStep";
import { AccountRegisterStep } from "@/components/shop/account/drawer/steps/AccountRegisterStep";
import { AccountStartStep } from "@/components/shop/account/drawer/steps/AccountStartStep";
import type { MockAccountUser } from "@/types/account";

type AccountStep = "start" | "password" | "register" | "forgot";
type AccountStepSubmitHandler = (event: React.FormEvent<HTMLFormElement>) => void;

type AccountDrawerContentProps = {
  acceptedTerms: boolean;
  activeStep: AccountStep | "logged";
  email: string;
  normalizedEmail: string;
  password: string;
  passwordConfirmation: string;
  passwordIsValid: boolean;
  passwordsMatch: boolean;
  submitted: boolean;
  user: MockAccountUser | null;
  onAcceptedTermsChange: Dispatch<SetStateAction<boolean>>;
  onBackToMobileMenu: () => void;
  onClose: () => void;
  onEmailChange: Dispatch<SetStateAction<string>>;
  onForgot: () => void;
  onLoginSubmit: AccountStepSubmitHandler;
  onPasswordChange: Dispatch<SetStateAction<string>>;
  onPasswordConfirmationChange: Dispatch<SetStateAction<string>>;
  onRegisterSubmit: AccountStepSubmitHandler;
  onStartSubmit: AccountStepSubmitHandler;
  onStepChange: Dispatch<SetStateAction<AccountStep>>;
  onLogout: () => void;
};

export function AccountDrawerContent({
  acceptedTerms,
  activeStep,
  email,
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
  onLoginSubmit,
  onLogout,
  onPasswordChange,
  onPasswordConfirmationChange,
  onRegisterSubmit,
  onStartSubmit,
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
          onSubmit={onStartSubmit}
          submitted={submitted}
        />
      ) : null}

      {activeStep === "password" ? (
        <AccountPasswordStep
          normalizedEmail={normalizedEmail}
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
          onPasswordChange={onPasswordChange}
          onPasswordConfirmationChange={onPasswordConfirmationChange}
          onSubmit={onRegisterSubmit}
          password={password}
          passwordConfirmation={passwordConfirmation}
          passwordsMatch={passwordsMatch}
          submitted={submitted}
        />
      ) : null}

      {activeStep === "forgot" ? (
        <AccountForgotStep
          normalizedEmail={normalizedEmail}
          onBackToPassword={() => onStepChange("password")}
          onClose={onClose}
        />
      ) : null}

      {activeStep === "logged" && user ? (
        <AccountLoggedStep onClose={onClose} onLogout={onLogout} user={user} />
      ) : null}
    </div>
  );
}
