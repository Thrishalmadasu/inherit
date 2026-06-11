import { notFound } from "next/navigation";
import { CompanyView } from "@/components/company/company-view";
import { getCompanyPage } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CompanyPage(props: PageProps<"/companies/[slug]">) {
  const { slug } = await props.params;
  const company = await getCompanyPage(slug);
  if (!company) notFound();
  return <CompanyView company={company} />;
}
