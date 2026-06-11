import { ShareForm } from "@/components/share/share-form";

export default async function SharePage(props: PageProps<"/share">) {
  const { edit } = await props.searchParams;
  const editId = typeof edit === "string" ? edit : undefined;
  return <ShareForm editId={editId} />;
}
