import WatchdogClient from "@/components/WatchdogClient";

export const metadata = {
  title: "Hlídací pes – Bytolov",
  description: "Nastavte si hlídacího psa a dostávejte upozornění na nové nemovitosti",
};

export default function WatchdogPage() {
  return <WatchdogClient />;
}
