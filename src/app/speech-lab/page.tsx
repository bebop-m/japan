import { JapaneseInputLab } from "@/components/japanese-input-lab";
import { PixelCard } from "@/components/pixel-card";
import { PixelHeading } from "@/components/pixel-heading";
import { SpeechLabClient } from "@/components/speech-lab-client";

export default function SpeechLabPage() {
  return (
    <div className="page-stack">
      <PixelHeading
        kicker="iOS Safari Early Risk Lab"
        title="Speech path test bench"
        description="This lab keeps microphone gesture rules, MediaRecorder support, IME safety, and Azure proxy scoring visible before they become production bugs."
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
