import { DesktopShell } from "@/components/desktop-shell";
import { getPortfolioData } from "@/lib/github";

export const revalidate = 900;

export default async function Home() {
  const data = await getPortfolioData();

  return <DesktopShell data={data} />;
}
