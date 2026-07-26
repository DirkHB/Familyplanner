import { listIdeas } from "@/lib/ideas/repository";
import { IdeenClient } from "./IdeenClient";

export const dynamic = "force-dynamic";

export default async function IdeenPage() {
  const ideas = await listIdeas();
  return <IdeenClient ideas={ideas} />;
}
