import { notFound } from "next/navigation";
import { ExperienceView } from "@/components/experience/experience-view";
import { getExperience } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ExperiencePage(props: PageProps<"/experiences/[id]">) {
  const { id } = await props.params;
  const data = await getExperience(id);
  if (!data) notFound();
  return <ExperienceView exp={data.exp} related={data.related} company={data.company} />;
}
