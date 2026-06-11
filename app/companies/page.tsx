import { CompaniesView } from "@/components/companies/companies-view";
import { listCompanies } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CompaniesIndexPage() {
  const companies = await listCompanies();
  return <CompaniesView companies={companies} />;
}
