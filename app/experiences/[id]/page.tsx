import { notFound } from "next/navigation";
import { ExperienceView } from "@/components/experience/experience-view";
import { requireDbUser } from "@/lib/auth";
import { getExperience, getViewerEngagement } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ExperiencePage(props: PageProps<"/experiences/[id]">) {
  const { id } = await props.params;
  const [user, data] = await Promise.all([requireDbUser(), getExperience(id)]);
  if (!data) notFound();
  const viewer = await getViewerEngagement(user.id, id);
  return (
    <ExperienceView
      exp={data.exp}
      related={data.related}
      company={data.company}
      viewer={viewer}
    />
  );
}
