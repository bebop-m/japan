import { PixelCard } from "@/components/pixel-card";
import { PixelHeading } from "@/components/pixel-heading";

export default function OfflinePage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="Offline Fallback"
        title="Network lost, shell kept."
      />
      <PixelCard>
        <p className="muted" style={{ margin: 0 }}>
          当前版本以壳层与内容预缓存为主，真实学习流程仍以在线访问为默认路径。
        </p>
      </PixelCard>
    </div>
  );
}
