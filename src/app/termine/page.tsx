import { ComingSoon } from "@/components/app/ComingSoon";
export const dynamic = "force-dynamic";
export default function TerminePage() {
  return (
    <ComingSoon
      title="Termine"
      text="Die Wochenansicht zeigt schon eure Termine. Eine Tages- und Listenansicht kommt hier dazu."
      cta={{ href: "/woche", label: "Zur Woche" }}
    />
  );
}
