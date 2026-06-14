import { CompaniesView } from "@/components/companies/companies-view";
import { listCompaniesPage } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

// Server-paginated companies grid (?q & ?page). Ordered by visible-experience
// count desc; search matches name / industry / alias. 10 per page.
export default async function CompaniesIndexPage(props: PageProps<"/companies">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = typeof sp.page === "string" ? Math.max(1, Number.parseInt(sp.page, 10) || 1) : 1;
  const data = await listCompaniesPage({ q, page });
  return <CompaniesView data={data} q={q} page={page} />;
}
