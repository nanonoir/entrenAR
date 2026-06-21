"use client";

import { ImagePlus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";

type ImageDropZoneProps = {
  label: string;
  value?: string;
  onChange: (value?: string) => void;
  errorText?: string;
};

export function ImageDropZone({ errorText, label, onChange, value }: ImageDropZoneProps) {
  const id = useId();
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-text">{label}</span>
      <label
        htmlFor={id}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
        className={`grid cursor-pointer gap-3 rounded-3xl border border-dashed p-5 text-center transition ${isDragging ? "border-accent bg-accent-soft" : "border-zinc-300 bg-white hover:border-accent"}`}
      >
        {value ? (
          <span
            aria-label="Vista previa de imagen"
            role="img"
            className="mx-auto aspect-video max-h-56 w-full rounded-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${value})` }}
          />
        ) : (
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ImagePlus aria-hidden size={24} />
          </span>
        )}
        <span className="font-semibold text-zinc-950">Arrastrá y soltá, o subí fotos del producto</span>
        <span className="text-sm text-zinc-500">Tamaño mínimo recomendado: 1280px / Formatos recomendados: WEBP, PNG, JPEG o GIF</span>
        <input id={id} type="file" accept="image/*" className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} />
      </label>
      {value ? <Button type="button" variant="secondary" size="sm" onClick={() => onChange(undefined)}><X aria-hidden size={16} />Quitar imagen</Button> : null}
      {errorText ? <span className="text-xs font-medium text-sale">{errorText}</span> : null}
    </div>
  );
}
