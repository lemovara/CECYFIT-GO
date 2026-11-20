import { notFound } from "next/navigation";
import { HostPanel } from "@/components/cecyfit/HostPanel";
import { resolveHostRoute } from "@/components/cecyfit/hostRoutes";

export default async function PanelPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const route = resolveHostRoute((await params).segments);
  if (!route) notFound();
  return <HostPanel {...route} />;
}
