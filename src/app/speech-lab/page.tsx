import { JapaneseInputLab } from "@/components/japanese-input-lab";
import { PixelCard } from "@/components/pixel-card";
import { PixelHeading } from "@/components/pixel-heading";
import { SpeechLabClient } from "@/components/speech-lab-client";

export default function SpeechLabPage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="iOS 发音测试台"
        title="语音路径测试"
        description="验证麦克风权限、录音格式、Azure评分在生产前正常工作。"
      />

      <div className="two-column">
        <PixelCard>
          <h2 className="section-title">Microphone + Azure Proxy</h2>
          <SpeechLabClient />
        </PixelCard>
        <PixelCard>
          <h2 className="section-title">IME Safety</h2>
          <JapaneseInputLab />
        </PixelCard>
      </div>
    </div>
  );
}
