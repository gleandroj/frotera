import type { FieldErrors, FieldValues, Path } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

/** Callback for `form.handleSubmit(onValid, here)` — toast + foco no primeiro campo com erro. */
export function onRhfInvalidSubmit<T extends FieldValues>(
  form: UseFormReturn<T>,
  t: (key: string) => string,
  messageKey = "common.formValidationFailed",
) {
  return (errors: FieldErrors<T>) => {
    const first = Object.keys(errors)[0] as Path<T> | undefined;
    if (first) void form.setFocus(first);
    toast.error(t(messageKey));
  };
}
