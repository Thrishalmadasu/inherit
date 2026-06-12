import { notFound } from "next/navigation";
import { ShareForm } from "@/components/share/share-form";
import { requireDbUser } from "@/lib/auth";
import { getEditPrefill } from "@/lib/db/queries";

// ?edit=<id> → load the author's own post from the DB and hand it to the form
// as a prefill (the form layers any in-progress edit draft on top of it).
export default async function SharePage(props: PageProps<"/share">) {
  const { edit } = await props.searchParams;
  const editId = typeof edit === "string" ? edit : undefined;

  if (editId) {
    const user = await requireDbUser();
    const prefill = await getEditPrefill(editId, user.id);
    if (!prefill) notFound();
    return <ShareForm editId={editId} prefill={prefill.form} editStatus={prefill.status} />;
  }
  return <ShareForm />;
}
