import { SearchView } from "@/components/search/search-view";
import { getSearchSuggestions, listCompanies } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const initialQ = typeof q === "string" ? q : "";
  // Experiences are searched server-side from the client (bounded); only the
  // small companies list + the dynamic suggestion chips load up front.
  const [companies, suggestions] = await Promise.all([listCompanies(), getSearchSuggestions()]);
  return <SearchView initialQ={initialQ} companies={companies} suggestions={suggestions} />;
}
