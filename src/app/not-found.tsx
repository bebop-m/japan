import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";

export default function NotFound() {
  return (
    <div className="page-stack">
      <PixelCard>
        <h1 className="display" style={{ marginTop: 0 }}>
          PAGE NOT FOUND
        </h1>
        <p className="muted">
          这页还没被纳入 NIHONGO.GO 的信息架构，先回主面板继续看 Phase 1 骨架。
        </p>
        <PixelButton href="/">BACK HOME</PixelButton>
      </PixelCard>
    </div>
  );
}
