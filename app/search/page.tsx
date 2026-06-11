import { SearchView } from "@/components/search/search-view";

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const initialQ = typeof q === "string" ? q : "";
  return <SearchView initialQ={initialQ} />;
}
