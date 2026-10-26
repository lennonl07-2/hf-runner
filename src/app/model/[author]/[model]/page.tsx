import Runner from "@/components/runner";
export default async function Page({
  params,
}: {
  params: Promise<{ author: string; model: string }>;
}) {
  const p = await params;
  return <Runner initial={`${p.author}/${p.model}`} />;
}
