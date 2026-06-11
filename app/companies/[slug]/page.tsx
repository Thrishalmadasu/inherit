import { CompanyView } from "@/components/company/company-view";

// Phase 0: mock data only models Amazon, so every slug renders the Amazon
// aggregate. Real per-slug data arrives with the DB in Phase 1.
export default async function CompanyPage(props: PageProps<"/companies/[slug]">) {
  await props.params;
  return <CompanyView />;
}
