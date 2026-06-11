import { SearchView } from "@/components/search/search-view";
import { listCompanies, listFeed } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const initialQ = typeof q === "string" ? q : "";
  const [companies, experiences] = await Promise.all([listCompanies(), listFeed()]);
  return (
    <SearchView initialQ={initialQ} companies={companies} experiences={experiences} />
  );
}
