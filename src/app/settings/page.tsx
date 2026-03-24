import { PixelHeading } from "@/components/pixel-heading";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <div className="page-stack">
      <PixelHeading kicker="SETTINGS" title="设置与备份" />
      <SettingsPanel />
    </div>
  );
}
