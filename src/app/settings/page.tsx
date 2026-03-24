import { PixelHeading } from "@/components/pixel-heading";
import { SettingsLaunchPanel } from "@/components/settings-launch-panel";
import { SettingsPanel } from "@/components/settings-panel";

interface SettingsPageProps {
  searchParams?: {
    manage?: string;
  };
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  const isManaging = searchParams?.manage === "1";

  if (!isManaging) {
    return (
      <div className="compact-page">
        <SettingsLaunchPanel />
      </div>
    );
  }

  return (
    <div className="compact-page">
      <PixelHeading kicker="SETTINGS" title="设置与备份" />
      <SettingsPanel />
    </div>
  );
}
