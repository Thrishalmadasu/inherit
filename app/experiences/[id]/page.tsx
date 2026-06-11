import { ExperienceView } from "@/components/experience/experience-view";

export default async function ExperiencePage(props: PageProps<"/experiences/[id]">) {
  const { id } = await props.params;
  return <ExperienceView id={id} />;
}
