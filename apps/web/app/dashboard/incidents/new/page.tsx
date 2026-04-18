import { redirect } from "next/navigation";

/** Nova ocorrência abre no sheet da lista. */
export default function IncidentsNewRedirectPage() {
  redirect("/dashboard/incidents");
}
