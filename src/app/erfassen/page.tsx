import { aiConfigured } from "@/lib/ai/client";
import { ErfassenClient } from "./ErfassenClient";

export const dynamic = "force-dynamic";

export default function ErfassenPage() {
  return <ErfassenClient configured={aiConfigured()} />;
}
