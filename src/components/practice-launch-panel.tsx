"use client";

import { useMemo } from "react";
import { ModeLaunchPanel } from "@/components/mode-launch-panel";
import { buildPracticePool } from "@/lib/practice/session";
import { getMasteredSentenceCount } from "@/lib/review/srs";
import { readStorageState } from "@/lib/storage/local";
import type { PhraseCard, WordCard } from "@/lib/types/content";

interface PracticeLaunchPanelProps {
  phraseCards: PhraseCard[];
  wordCards: WordCard[];
}

export function PracticeLaunchPanel({
  phraseCards,
  wordCards
}: PracticeLaunchPanelProps) {
  const storage = useMemo(() => readStorageState(), []);
  const sentencePool = buildPracticePool(storage, phraseCards, wordCards, "all", "sentence").length;
  const wordPool = buildPracticePool(storage, phraseCards, wordCards, "all", "word").length;
  const mixedPool = buildPracticePool(storage, phraseCards, wordCards, "all", "mixed").length;
  const masteredCount = getMasteredSentenceCount(storage);
  const hasPool = mixedPool > 0 || sentencePool > 0;

  return (
    <ModeLaunchPanel
      modeLabel="PRACTICE LAB"
      badge={hasPool ? `POOL ${mixedPool}` : "LOCKED"}
      art="practice"
      title="PRACTICE"
      subtitle="练输出，不改 SRS"
      dialogTitle="MODE BRIEF"
      dialogLines={[
        hasPool
          ? `当前可抽取 ${mixedPool} 个混合题目，适合先拿来做速度热身。`
          : "现在还没有足够的题库可抽，你可以先完成课程或复习后再回来。",
        "这一版只先把入口模板和模式分工立起来，不急着把具体玩法做满。"
      ]}
      stats={[
        { label: "句子池", value: `${sentencePool}` },
        { label: "词语池", value: `${wordPool}` },
        { label: "已入复习", value: `${masteredCount}` }
      ]}
      primaryAction={{
        href: hasPool ? "/practice?play=1" : "/",
        label: hasPool ? "进入速度练习" : "先去首页"
      }}
      secondaryActions={[
        {
          href: "/",
          label: "返回主菜单",
          variant: "secondary"
        },
        {
          href: "/review",
          label: "先做复习",
          variant: "ghost"
        }
      ]}
      menuItems={[
        {
          href: "/practice?play=1",
          label: "混合模式",
          value: `${mixedPool}`,
          variant: mixedPool > 0 ? "secondary" : "ghost"
        },
        {
          href: "/practice?play=1",
          label: "句子冲刺",
          value: `${sentencePool}`,
          variant: sentencePool > 0 ? "secondary" : "ghost"
        },
        {
          href: "/practice?play=1",
          label: "词语热身",
          value: `${wordPool}`,
          variant: wordPool > 0 ? "secondary" : "ghost"
        }
      ]}
      footerNote="后面如果方向对，这里最适合扩成 1 分钟冲刺、连连看、连击条这些小游戏入口。"
    />
  );
}
