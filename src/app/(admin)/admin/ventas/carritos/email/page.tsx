"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Copy, Eye, FileText, Mail, Save } from "lucide-react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { formatARS } from "@/lib/data/admin/sales-flow/helpers";
import { useAdminAbandonedCartsStore } from "@/stores/admin-abandoned-carts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { cn } from "@/lib/utils";

const EDITOR_TAB = {
  HTML: "html",
  PLAIN: "plain",
  PREVIEW: "preview",
} as const;

type EditorTab = (typeof EDITOR_TAB)[keyof typeof EDITOR_TAB];

const TABS: Array<{ key: EditorTab; label: string; icon: typeof FileText }> = [
  { key: EDITOR_TAB.HTML, label: "HTML", icon: FileText },
  { key: EDITOR_TAB.PLAIN, label: "Texto plano", icon: Mail },
  { key: EDITOR_TAB.PREVIEW, label: "Vista previa", icon: Eye },
];

const TEMPLATE_VARIABLE = {
  NAME: "{{nombre}}",
  TOTAL: "{{total}}",
  CHECKOUT_URL: "{{checkoutUrl}}",
} as const;

const TEMPLATE_VARIABLES = [TEMPLATE_VARIABLE.NAME, TEMPLATE_VARIABLE.TOTAL, TEMPLATE_VARIABLE.CHECKOUT_URL] as const;
const TEMPLATE_FIELD = { HTML: "htmlBody", PLAIN: "plainTextBody" } as const;
type TemplateField = (typeof TEMPLATE_FIELD)[keyof typeof TEMPLATE_FIELD];

const SAMPLE_VALUES = {
  nombre: "Lucía Molina",
  total: formatARS(87_800),
  checkoutUrl: "https://entrenar.com/checkout?recoveryToken=demo",
} as const;

const recoveryTemplateSchema = z.object({
  subject: z.string().trim().min(3, { error: "El asunto debe tener al menos 3 caracteres." }).max(240, { error: "El asunto es demasiado largo." }),
  htmlBody: z.string().trim().min(1, { error: "Ingresá el contenido HTML del mensaje." }).max(100_000, { error: "El contenido HTML es demasiado largo." }),
  plainTextBody: z.string().trim().min(1, { error: "Ingresá el contenido de texto plano." }).max(100_000, { error: "El contenido de texto plano es demasiado largo." }),
});

type RecoveryEmailTemplateInput = z.input<typeof recoveryTemplateSchema>;
type RecoveryEmailTemplateValues = z.infer<typeof recoveryTemplateSchema>;

export default function RecoveryEmailEditorPage() {
  const template = useAdminAbandonedCartsStore((state) => state.template);
  const error = useAdminAbandonedCartsStore((state) => state.error);
  const isLoading = useAdminAbandonedCartsStore((state) => state.isLoading);
  const isMutating = useAdminAbandonedCartsStore((state) => state.isMutating);
  const fetchTemplate = useAdminAbandonedCartsStore((state) => state.fetchTemplate);
  const updateTemplate = useAdminAbandonedCartsStore((state) => state.updateTemplate);
  const clearError = useAdminAbandonedCartsStore((state) => state.clearError);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [activeTab, setActiveTab] = useState<EditorTab>(EDITOR_TAB.HTML);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<RecoveryEmailTemplateInput, unknown, RecoveryEmailTemplateValues>({
    defaultValues: template,
    mode: "onBlur",
    resolver: zodResolver(recoveryTemplateSchema),
  });
  const { errors, isDirty, isSubmitted, isSubmitting } = form.formState;
  const subject = useWatch({ control: form.control, name: "subject" }) ?? "";
  const htmlBody = useWatch({ control: form.control, name: "htmlBody" }) ?? "";
  const plainTextBody = useWatch({ control: form.control, name: "plainTextBody" }) ?? "";
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty });

  useEffect(() => {
    void fetchTemplate();
  }, [fetchTemplate]);

  useEffect(() => {
    if (!isDirty) form.reset(template);
  }, [form, isDirty, template]);

  async function handleSave(values: RecoveryEmailTemplateValues) {
    setSubmitError(null);
    setSaved(false);
    clearError();
    const result = await updateTemplate(values);
    if (!result) {
      setSubmitError("No se pudo guardar el mensaje. Intentá nuevamente.");
      return;
    }
    form.reset(result);
    setSaved(true);
    addToast("Mensaje de e-mail guardado correctamente.");
  }

  function handleInvalidSubmit(formErrors: typeof errors) {
    setSubmitError("Debes completar todos los campos obligatorios correctamente.");
    addToast("Revisá los campos del template.", "error");
    scrollToFirstError(formErrors);
  }

  function handleBack(event: MouseEvent<HTMLAnchorElement>) {
    if (!isDirty) return;
    event.preventDefault();
    interceptNavigation("/admin/ventas/carritos");
  }

  function insertVariable(variable: string) {
    const field: TemplateField = activeTab === EDITOR_TAB.PLAIN ? TEMPLATE_FIELD.PLAIN : TEMPLATE_FIELD.HTML;
    const currentValue = form.getValues(field);
    const separator = currentValue.length > 0 && !/\s$/.test(currentValue) ? " " : "";
    form.setValue(field, `${currentValue}${separator}${variable}`, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }

  async function copyVariable(variable: string) {
    if (!navigator.clipboard) {
      addToast("Tu navegador no permite copiar automáticamente.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(variable);
      addToast(`${variable} copiada al portapapeles.`);
    } catch {
      addToast("No se pudo copiar la variable.", "error");
    }
  }

  const visibleError = submitError ?? (isSubmitted ? error : null);
  const saving = isSubmitting || isMutating;
  const htmlPreview = renderTemplate(htmlBody);
  const plainPreview = renderTemplate(plainTextBody);

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/ventas/carritos" onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"><ArrowLeft aria-hidden size={16} />Volver a carritos abandonados</Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950">Editar mensaje de e-mail</h1>
          <p className="mt-1 text-sm text-zinc-500">Editá el template mock de recuperación. No se envían e-mails reales.</p>
        </div>
        <Button type="submit" form="recovery-email-form" variant="primary" size="sm" disabled={saving} aria-busy={saving}><Save aria-hidden size={16} />{saving ? "Guardando…" : "Guardar mensaje"}</Button>
      </div>

      {isLoading ? <div role="status" className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">Cargando template…</div> : null}
      {visibleError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">{visibleError}</div> : null}
      {saved ? <div role="status" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">Mensaje guardado en el estado local mock.</div> : null}

      <form id="recovery-email-form" className="grid gap-5" noValidate onSubmit={form.handleSubmit(handleSave, handleInvalidSubmit)}>
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <Input id="recovery-email-subject" label="Asunto *" helperText="Mínimo 3 caracteres. Usá variables como {{nombre}} si querés personalizar el mensaje." errorText={errors.subject?.message} {...form.register("subject")} />
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-zinc-100 p-3" role="tablist" aria-label="Editor de e-mail de recuperación">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return <button key={tab.key} id={`recovery-email-tab-${tab.key}`} type="button" role="tab" aria-selected={active} aria-controls={`recovery-email-panel-${tab.key}`} onClick={() => setActiveTab(tab.key)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition", active ? "border-accent bg-accent text-on-accent" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50")}><Icon aria-hidden size={14} />{tab.label}</button>;
            })}
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-2 rounded-2xl bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Variables disponibles</p><p className="mt-1 text-xs text-zinc-500">Tocá una para insertarla en {activeTab === EDITOR_TAB.PLAIN ? "texto plano" : "HTML"}; también podés copiarla.</p></div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((variable) => <span key={variable} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white pl-3 text-xs font-semibold text-accent"><button type="button" onClick={() => insertVariable(variable)} className="py-2 hover:underline">{variable}</button><Button type="button" variant="ghost" size="icon" aria-label={`Copiar ${variable}`} onClick={() => void copyVariable(variable)}><Copy aria-hidden size={13} /></Button></span>)}
              </div>
            </div>

            {activeTab === EDITOR_TAB.HTML ? <div id="recovery-email-panel-html" role="tabpanel" aria-labelledby="recovery-email-tab-html" className="mt-4"><Textarea id="recovery-email-html" label="HTML del e-mail *" helperText="Editá el cuerpo HTML. La vista previa renderiza este contenido localmente." errorText={errors.htmlBody?.message} className="min-h-[360px] font-mono" {...form.register("htmlBody")} /></div> : null}
            {activeTab === EDITOR_TAB.PLAIN ? <div id="recovery-email-panel-plain" role="tabpanel" aria-labelledby="recovery-email-tab-plain" className="mt-4"><Textarea id="recovery-email-plain" label="Texto plano *" helperText="Versión de respaldo para clientes que no renderizan HTML." errorText={errors.plainTextBody?.message} className="min-h-[360px] font-mono" {...form.register("plainTextBody")} /></div> : null}
            {activeTab === EDITOR_TAB.PREVIEW ? <div id="recovery-email-panel-preview" role="tabpanel" aria-labelledby="recovery-email-tab-preview" className="mt-4 grid gap-5 lg:grid-cols-2"><PreviewCard title="Preview HTML" subject={subject}><div className="prose prose-sm max-w-none text-zinc-700" dangerouslySetInnerHTML={{ __html: htmlPreview || "<p>Sin contenido HTML.</p>" }} /></PreviewCard><PreviewCard title="Preview texto plano" subject={subject}><pre className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{plainPreview || "Sin contenido de texto plano."}</pre></PreviewCard></div> : null}
          </div>
        </div>
      </form>
      {discardModal}
    </div>
  );
}

function PreviewCard({ children, subject, title }: { children: ReactNode; subject: string; title: string }) {
  return <section className="rounded-2xl border border-zinc-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p><h2 className="mt-2 text-lg font-bold text-zinc-950">{subject || "Sin asunto"}</h2><div className="mt-4">{children}</div></section>;
}

function renderTemplate(template: string): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in SAMPLE_VALUES)) return match;
    return SAMPLE_VALUES[key as keyof typeof SAMPLE_VALUES];
  });
}
