import { PixelHeading } from "@/components/pixel-heading";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <div className="compact-page">
      <PixelHeading kicker="SETTINGS" title="设置与备份" />
      <SettingsPanel />
    </div>
  );
}
