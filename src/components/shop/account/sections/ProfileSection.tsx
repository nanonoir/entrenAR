"use client";

import { type FormEvent, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { useAccountProfileStore } from "@/stores/account-profile-store";
import type { AccountProfile } from "@/types/account";

type ProfileSectionProps = {
  profile: AccountProfile;
  userEmail: string;
};

export function ProfileSection({ profile, userEmail }: ProfileSectionProps) {
  const updateProfile = useAccountProfileStore((state) => state.updateProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  function updateField(field: keyof AccountProfile, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile(userEmail, draft);
    setEditing(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <SectionHeader
        action={
          <Button onClick={() => setEditing((current) => !current)} type="button" variant="secondary">
            <Pencil aria-hidden size={18} />
            Editar
          </Button>
        }
        title="Perfil"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Nombre"
          onChange={(event) => updateField("firstName", event.target.value)}
          readOnly={!editing}
          value={draft.firstName}
        />
        <Input
          label="Apellido"
          onChange={(event) => updateField("lastName", event.target.value)}
          readOnly={!editing}
          value={draft.lastName}
        />
        <Input label="Email" readOnly type="email" value={draft.email} />
        <Input
          label="DNI"
          onChange={(event) => updateField("dni", event.target.value)}
          readOnly={!editing}
          value={draft.dni}
        />
        <Input
          label="Género"
          onChange={(event) => updateField("gender", event.target.value)}
          readOnly={!editing}
          value={draft.gender}
        />
        <Input
          label="Fecha de Nacimiento"
          onChange={(event) => updateField("birthDate", event.target.value)}
          readOnly={!editing}
          type="date"
          value={draft.birthDate}
        />
        <Input
          className="md:col-span-2"
          label="Teléfono"
          onChange={(event) => updateField("phone", event.target.value)}
          readOnly={!editing}
          value={draft.phone}
        />
      </div>
      {editing ? (
        <Button className="mt-5" type="submit">
          Guardar cambios
        </Button>
      ) : null}
    </form>
  );
}
