"use client";

import { type FormEvent, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  AccountState,
  focusFirstInvalidField,
  getAccountFieldError,
  getProfileFieldErrors,
  type AccountProfileField,
} from "@/components/shop/account/AccountState";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { useAccountProfileStore } from "@/stores/account-profile-store";
import { ACCOUNT_ASYNC_STATUS, type AccountProfile } from "@/types/account";

type ProfileSectionProps = {
  profile: AccountProfile | null;
  userEmail: string;
};

export function ProfileSection({ profile, userEmail }: ProfileSectionProps) {
  const loadProfile = useAccountProfileStore((state) => state.loadProfile);
  const updateProfile = useAccountProfileStore((state) => state.updateProfile);
  const profileError = useAccountProfileStore((state) => state.profileError);
  const profileStatus = useAccountProfileStore((state) => state.profileStatus);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AccountProfile>(profile ?? createEmptyProfile(userEmail));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<AccountProfileField, boolean>>>({});

  if (!profile) {
    return (
      <AccountState
        empty={
          <div className="grid gap-4 rounded-card border border-dashed border-border bg-surface p-8 text-center">
            <h3 className="font-subtitle text-xl font-semibold uppercase">Perfil no disponible</h3>
            <p className="text-sm leading-6 text-text-muted">No encontramos los datos de tu perfil.</p>
            <Button className="justify-self-center" onClick={() => void loadProfile(userEmail)} variant="secondary">
              Reintentar
            </Button>
          </div>
        }
        error={profileError}
        isEmpty
        loadingTitle="Cargando tu perfil"
        onRetry={() => loadProfile(userEmail)}
        status={profileStatus === ACCOUNT_ASYNC_STATUS.IDLE ? ACCOUNT_ASYNC_STATUS.LOADING : profileStatus}
      >
        {null}
      </AccountState>
    );
  }

  const currentProfile = profile;
  const formProfile = editing ? draft : currentProfile;
  const errors = getProfileFieldErrors(formProfile);
  const isLoading = isSaving || profileStatus === ACCOUNT_ASYNC_STATUS.LOADING;

  function updateField(field: AccountProfileField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function handleBlur(field: AccountProfileField) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function fieldError(field: AccountProfileField) {
    if (!submitted && !touchedFields[field]) {
      return undefined;
    }

    return errors[field] ?? getAccountFieldError(profileError, field);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    setSubmitted(true);
    setSaved(false);

    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(
        profileFieldIds,
        profileFieldOrder.filter((field) => errors[field]).map((field) => profileFieldIdByField[field]),
      );
      return;
    }

    setIsSaving(true);
    const updated = await updateProfile(userEmail, formProfile);
    setIsSaving(false);

    if (updated) {
      setEditing(false);
      setSaved(true);
      setSubmitted(false);
      setTouchedFields({});
    }
  }

  function toggleEditing() {
    if (editing) {
      setDraft(currentProfile);
      setSubmitted(false);
      setTouchedFields({});
      setSaved(false);
    } else {
      setSaved(false);
    }

    setEditing((current) => !current);
  }

  return (
    <AccountState
      error={profileError}
      hasData
      loadingTitle="Guardando tu perfil"
      onRetry={() => loadProfile(userEmail)}
      status={profileStatus}
    >
      <form onSubmit={handleSubmit}>
      <SectionHeader
        action={
          <Button disabled={isLoading} onClick={toggleEditing} type="button" variant="secondary">
            <Pencil aria-hidden size={18} />
            {editing ? "Cancelar" : "Editar"}
          </Button>
        }
        title="Perfil"
      />
      {submitted && Object.keys(errors).length > 0 ? (
        <div className="mb-5 rounded-card border border-sale/30 bg-red-50 p-3 text-sm font-medium text-sale" role="alert">
          Revisá los campos marcados antes de guardar los cambios.
        </div>
      ) : null}
      {saved ? (
        <p className="mb-5 rounded-card border border-accent/30 bg-accent-soft p-3 text-sm font-medium text-accent" role="status">
          Tus datos se actualizaron correctamente.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          errorText={editing ? fieldError("firstName") : undefined}
          helperText={fieldError("firstName") ? undefined : "Letras, espacios, apóstrofes o guiones."}
          id="account-profile-first-name"
          label="Nombre"
          maxLength={120}
          onBlur={() => handleBlur("firstName")}
          onChange={(event) => updateField("firstName", event.target.value)}
          readOnly={!editing}
           value={formProfile.firstName}
        />
        <Input
          errorText={editing ? fieldError("lastName") : undefined}
          helperText={fieldError("lastName") ? undefined : "Letras, espacios, apóstrofes o guiones."}
          id="account-profile-last-name"
          label="Apellido"
          maxLength={120}
          onBlur={() => handleBlur("lastName")}
          onChange={(event) => updateField("lastName", event.target.value)}
          readOnly={!editing}
           value={formProfile.lastName}
        />
        <Input helperText="Este email identifica tu cuenta y no se puede editar aquí." id="account-profile-email" label="Email" readOnly type="email" value={formProfile.email} />
        <Input
          errorText={editing ? fieldError("dni") : undefined}
          helperText={fieldError("dni") ? undefined : "Entre 6 y 9 números."}
          id="account-profile-dni"
          label="DNI"
          inputMode="numeric"
          maxLength={9}
          onBlur={() => handleBlur("dni")}
          onChange={(event) => updateField("dni", event.target.value)}
          readOnly={!editing}
           value={formProfile.dni}
        />
        <Input
          errorText={editing ? fieldError("gender") : undefined}
          helperText={fieldError("gender") ? undefined : "Podés escribir cómo te identificás."}
          id="account-profile-gender"
          label="Género"
          maxLength={40}
          onBlur={() => handleBlur("gender")}
          onChange={(event) => updateField("gender", event.target.value)}
          readOnly={!editing}
           value={formProfile.gender}
        />
        <Input
          errorText={editing ? fieldError("birthDate") : undefined}
          helperText={fieldError("birthDate") ? undefined : "Elegí tu fecha de nacimiento."}
          id="account-profile-birth-date"
          label="Fecha de Nacimiento"
          onBlur={() => handleBlur("birthDate")}
          onChange={(event) => updateField("birthDate", event.target.value)}
          readOnly={!editing}
          type="date"
           value={formProfile.birthDate}
        />
        <Input
          className="md:col-span-2"
          errorText={editing ? fieldError("phone") : undefined}
          helperText={fieldError("phone") ? undefined : "Ej: +54 11 4567-8901."}
          id="account-profile-phone"
          label="Teléfono"
          maxLength={24}
          onBlur={() => handleBlur("phone")}
          onChange={(event) => updateField("phone", event.target.value)}
          readOnly={!editing}
           value={formProfile.phone}
        />
      </div>
      {editing ? (
        <Button className="mt-5" disabled={isLoading} type="submit">
          {isLoading ? "Guardando..." : "Guardar cambios"}
        </Button>
      ) : null}
      </form>
    </AccountState>
  );
}

const profileFieldIds = [
  "account-profile-first-name",
  "account-profile-last-name",
  "account-profile-dni",
  "account-profile-gender",
  "account-profile-birth-date",
  "account-profile-phone",
] as const;

const profileFieldOrder: AccountProfileField[] = [
  "firstName",
  "lastName",
  "dni",
  "gender",
  "birthDate",
  "phone",
];

const profileFieldIdByField: Record<AccountProfileField, (typeof profileFieldIds)[number]> = {
  birthDate: "account-profile-birth-date",
  dni: "account-profile-dni",
  firstName: "account-profile-first-name",
  gender: "account-profile-gender",
  lastName: "account-profile-last-name",
  phone: "account-profile-phone",
};

function createEmptyProfile(email: string): AccountProfile {
  return {
    birthDate: "",
    dni: "",
    email,
    firstName: "",
    gender: "",
    lastName: "",
    phone: "",
  };
}
