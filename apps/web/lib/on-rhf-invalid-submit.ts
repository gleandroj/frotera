import type { FieldErrors, FieldValues, Path } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

/** Primeiro caminho com `message` (suporta erros aninhados, ex.: itens de array). */
function firstErrorPath(errors: Record<string, unknown>, prefix = ""): string | undefined {
  for (const key of Object.keys(errors)) {
    const val = errors[key] as Record<string, unknown> | undefined;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object") {
      if ("message" in val && typeof val.message === "string") return path;
      const sub = firstErrorPath(val as Record<string, unknown>, path);
      if (sub) return sub;
    }
  }
  return undefined;
}

/** Callback para `form.handleSubmit(onValid, here)` — toast + foco no primeiro campo com erro. */
export function onRhfInvalidSubmit<T extends FieldValues>(
  form: UseFormReturn<T>,
  t: (key: string) => string,
  messageKey = "common.formValidationFailed",
) {
  return (errors: FieldErrors<T>) => {
    const path =
      firstErrorPath(errors as Record<string, unknown>) ??
      (Object.keys(errors)[0] as string | undefined);
    if (path) void form.setFocus(path as Path<T>);
    toast.error(t(messageKey));
  };
}
