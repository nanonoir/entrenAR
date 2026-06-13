"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, FileText, Mail, Save } from "lucide-react";
import { useAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

type EditorTab = "html" | "plain" | "preview";

const TABS: { key: EditorTab; label: string; icon: typeof FileText }[] = [
  { key: "html", label: "HTML", icon: FileText },
  { key: "plain", label: "Texto plano", icon: Mail },
  { key: "preview", label: "Vista previa", icon: Eye },
];

export default function RecoveryEmailEditorPage() {
  const template = useAdminAbandonedCartsStore((state) => state.template);
  const updateTemplate = useAdminAbandonedCartsStore((state) => state.updateTemplate);
  const [activeTab, setActiveTab] = useState<EditorTab>("html");
  const [subject, setSubject] = useState(template.subject);
  const [htmlBody, setHtmlBody] = useState(template.htmlBody);
  const [plainTextBody, setPlainTextBody] = useState(template.plainTextBody);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saved, setSaved] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const subjectError = submitAttempted && !subject.trim() ? "Ingresá un asunto para el e-mail." : undefined;
  const htmlError = submitAttempted && !htmlBody.trim() ? "Ingresá el contenido HTML del mensaje." : undefined;
  const plainError = submitAttempted && !plainTextBody.trim() ? "Ingresá el contenido de texto plano." : undefined;
  const hasErrors = Boolean(subjectError || htmlError || plainError);

  useEffect(() => {
    if (hasErrors) errorRef.current?.focus();
  }, [hasErrors]);

  function handleSave() {
    setSubmitAttempted(true);
    setSaved(false);
    if (!subject.trim() || !htmlBody.trim() || !plainTextBody.trim()) return;
    updateTemplate({
      subject: subject.trim(),
      htmlBody: htmlBody.trim(),
      plainTextBody: plainTextBody.trim(),
    });
    setSaved(true);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/ventas/carritos" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
            <ArrowLeft aria-hidden size={16} />
            Volver a carritos abandonados
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950">Editar mensaje de e-mail</h1>
          <p className="mt-1 text-sm text-zinc-500">Editá el template mock de recuperación. No se envían e-mails reales.</p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save aria-hidden size={16} />
          Guardar mensaje
        </Button>
      </div>

      {hasErrors && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale outline-none"
        >
          Debes completar todos los campos obligatorios correctamente.
        </div>
      )}
      {saved && !hasErrors && (
        <div role="status" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Mensaje guardado en el estado local mock.
        </div>
      )}

      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <Input
          id="recovery-email-subject"
          label="Asunto *"
          helperText="Usá variables como {{nombre}} si querés personalizar el mensaje."
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          errorText={subjectError}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-zinc-100 p-3" role="tablist" aria-label="Editor de e-mail de recuperación">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition",
                  active
                    ? "border-accent bg-accent text-on-accent"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
                )}
              >
                <Icon aria-hidden size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">
          {activeTab === "html" && (
            <Textarea
              id="recovery-email-html"
              label="HTML del e-mail *"
              helperText="Editá el cuerpo HTML. La vista previa renderiza este contenido localmente."
              value={htmlBody}
              onChange={(event) => setHtmlBody(event.target.value)}
              errorText={htmlError}
              className="min-h-[360px] font-mono text-base md:text-sm"
            />
          )}

          {activeTab === "plain" && (
            <Textarea
              id="recovery-email-plain"
              label="Texto plano *"
              helperText="Versión de respaldo para clientes que no renderizan HTML."
              value={plainTextBody}
              onChange={(event) => setPlainTextBody(event.target.value)}
              errorText={plainError}
              className="min-h-[360px] font-mono text-base md:text-sm"
            />
          )}

          {activeTab === "preview" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-zinc-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Preview HTML</p>
                <h2 className="mt-2 text-lg font-bold text-zinc-950">{subject || "Sin asunto"}</h2>
                <div className="prose prose-sm mt-4 max-w-none text-zinc-700" dangerouslySetInnerHTML={{ __html: htmlBody || "<p>Sin contenido HTML.</p>" }} />
              </section>
              <section className="rounded-2xl border border-zinc-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Preview texto plano</p>
                <h2 className="mt-2 text-lg font-bold text-zinc-950">{subject || "Sin asunto"}</h2>
                <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">{plainTextBody || "Sin contenido de texto plano."}</pre>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
