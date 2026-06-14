import { notFound } from "next/navigation";
import { ShareForm } from "@/components/share/share-form";
import { requireDbUser } from "@/lib/auth";
import { getEditPrefill, getShareFormOptions } from "@/lib/db/queries";
import { emptyForm, emptyRound } from "@/lib/share-form";

export const dynamic = "force-dynamic";

// ?edit=<id> → load the author's own post from the DB and hand it to the form
// as a prefill (the form layers any in-progress edit draft on top of it).
// ?company=&role=&round= → invite-link landing (PRD §7 Flow F #6): start the
// form pre-filled from the CSV row. An in-progress draft still wins - the
// form only uses the prefill when there's no saved draft.
export default async function SharePage(props: PageProps<"/share">) {
  const sp = await props.searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const editId = str(sp.edit) || undefined;

  if (editId) {
    const user = await requireDbUser();
    const [prefill, options] = await Promise.all([
      getEditPrefill(editId, user.id),
      getShareFormOptions(),
    ]);
    if (!prefill) notFound();
    return (
      <ShareForm editId={editId} prefill={prefill.form} editStatus={prefill.status} options={options} />
    );
  }

  const options = await getShareFormOptions();
  const company = str(sp.company);
  const role = str(sp.role);
  const round = str(sp.round);
  if (company || role || round) {
    const prefill = emptyForm({
      company,
      role,
      ...(round ? { rounds: [emptyRound(round)] } : {}),
    });
    return <ShareForm prefill={prefill} options={options} />;
  }
  return <ShareForm options={options} />;
}
