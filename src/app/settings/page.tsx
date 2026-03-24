import { PixelHeading } from "@/components/pixel-heading";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="SETTINGS"
        title="设置与备份"
        description="设置出发日期、导出或导入学习记录，并进入诊断工具。"
      />
      <SettingsPanel />
    </div>
  );
}
