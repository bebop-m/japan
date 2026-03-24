import type { SceneId } from "@/lib/types/content";

export interface HomeNextLesson {
  sceneId: SceneId;
  lessonId: string;
  title: string;
  href: string;
  sceneLabel: string;
}

export interface HomePrimaryAction {
  key: "review" | "lesson" | "departure" | "practice";
  title: string;
  description: string;
  label: string;
  href: string;
  badge: string;
}

export interface DepartureCountdownState {
  kind: "unset" | "normal" | "watch" | "urgent" | "today" | "past";
  daysUntil: number | null;
  tone: "neutral" | "success" | "danger";
  title: string;
  description: string;
  ctaLabel: string;
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map((token) => Number.parseInt(token, 10));

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRecommendedDailyCount(
  totalReviewItems: number,
  masteredSentenceCount: number,
  daysUntil: number
): number {
  const remaining = Math.max(totalReviewItems - masteredSentenceCount, 0);

  return Math.max(1, Math.ceil(remaining / Math.max(daysUntil, 1)));
}

export function resolveDepartureCountdown(input: {
  departureDateISO: string | null;
  totalReviewItems: number;
  masteredSentenceCount: number;
  departureReadyCount: number;
  now?: Date;
}): DepartureCountdownState {
  const date = parseDateOnly(input.departureDateISO);

  if (!date) {
    return {
      kind: "unset",
      daysUntil: null,
      tone: "neutral",
      title: "还没设置出发日期",
      description: "先设好日期，首页会自动显示倒计时、冲刺提醒和每日建议。",
      ctaLabel: "设置出发日期"
    };
  }

  const today = startOfDay(input.now ?? new Date());
  const target = startOfDay(date);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.round((target.getTime() - today.getTime()) / msPerDay);

  if (daysUntil < 0) {
    return {
      kind: "past",
      daysUntil,
      tone: "neutral",
      title: "出发日期已过",
      description: "如果还想按行前节奏学习，可以重新设置新的出发日期。",
      ctaLabel: "重新设置日期"
    };
  }

  if (daysUntil === 0) {
    return {
      kind: "today",
      daysUntil,
      tone: "danger",
      title: "今天出发",
      description:
        input.departureReadyCount > 0
          ? `优先冲刺这 ${input.departureReadyCount} 句出发储备，保持开口手感。`
          : "今天只保留最关键的练习，先去出发模式冲刺需要的句子。",
      ctaLabel: "立即冲刺"
    };
  }

  const recommendedDaily = getRecommendedDailyCount(
    input.totalReviewItems,
    input.masteredSentenceCount,
    daysUntil
  );

  if (daysUntil < 7) {
    return {
      kind: "urgent",
      daysUntil,
      tone: "danger",
      title: `距出发还有 ${daysUntil} 天`,
      description: `进入冲刺阶段，建议每天至少完成 ${recommendedDaily} 句，并优先刷出发模式。`,
      ctaLabel: "调整冲刺计划"
    };
  }

  if (daysUntil <= 30) {
    return {
      kind: "watch",
      daysUntil,
      tone: "success",
      title: `距出发还有 ${daysUntil} 天`,
      description: `已经进入行前准备窗口，建议每天至少完成 ${recommendedDaily} 句。`,
      ctaLabel: "查看出发计划"
    };
  }

  return {
    kind: "normal",
    daysUntil,
    tone: "neutral",
    title: `距出发还有 ${daysUntil} 天`,
    description: "时间还充足，按正常节奏推进课程和复习即可。",
    ctaLabel: "查看出发计划"
  };
}

export function resolvePrimaryAction(input: {
  countdown: DepartureCountdownState;
  dueReviewCount: number;
  nextLesson: HomeNextLesson | null;
  departureReadyCount: number;
}): HomePrimaryAction {
  if (input.countdown.kind === "today") {
    return {
      key: "departure",
      title: "今天只做出发冲刺",
      description: "把最需要说出口的句子再刷一遍，保持临场反应。",
      label: "出发冲刺",
      href: "/departure",
      badge: "出发日"
    };
  }

  if (input.dueReviewCount > 0) {
    return {
      key: "review",
      title: "今天先清空复习队列",
      description: `现在有 ${input.dueReviewCount} 句到期，先把复习清掉，再推进新内容。`,
      label: "立即复习",
      href: "/review",
      badge: "今日主任务"
    };
  }

  if (input.nextLesson) {
    return {
      key: "lesson",
      title: "继续推进下一课",
      description: `当前最值得做的是 ${input.nextLesson.sceneLabel} / ${input.nextLesson.title}。`,
      label: `继续课程：${input.nextLesson.title}`,
      href: input.nextLesson.href,
      badge: "今日主任务"
    };
  }

  if (input.departureReadyCount > 0) {
    return {
      key: "departure",
      title: "把出发句子冲到脱口而出",
      description: `你已经有 ${input.departureReadyCount} 句出发储备，可以进入冲刺模式。`,
      label: "出发冲刺",
      href: "/departure",
      badge: "今日主任务"
    };
  }

  return {
    key: "practice",
    title: "今天先保持输出手感",
    description: "当前没有到期复习，也没有待继续课程，先做一轮精准练习。",
    label: "开始练习",
    href: "/practice",
    badge: "今日主任务"
  };
}
