"use client";

import { useRef, useState } from "react";
import { PixelButton } from "@/components/pixel-button";
import { PixelCard } from "@/components/pixel-card";
import { getDueReviewItems, getMasteredSentenceCount, getPhraseReviewItemCount } from "@/lib/review/srs";
import { createStorageBackup, getStorageBackupFileName, parseStorageBackup } from "@/lib/storage/backup";
import { cloneStorageState } from "@/lib/storage/clone";
import { getDepartureReadyReviewItems } from "@/lib/storage/favorites";
import { readStorageState, writeStorageState } from "@/lib/storage/local";
import type { AppStorageState } from "@/lib/types/storage";

interface SettingsFeedback {
  tone: "neutral" | "success" | "danger";
  message: string;
}

export function SettingsPanel() {
  const [storage, setStorage] = useState<AppStorageState>(() => readStorageState());
  const [departureDateValue, setDepartureDateValue] = useState(
    storage.userSettings.departureDateISO ?? ""
  );
  const [feedback, setFeedback] = useState<SettingsFeedback>({
    tone: "neutral",
    message: "这里可以设置出发日期，并备份或恢复本机学习记录。"
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalPhraseCount = getPhraseReviewItemCount(storage);
  const reviewPoolCount = getMasteredSentenceCount(storage);
  const dueReviewCount = getDueReviewItems(storage).length;
  const departureReadyCount = getDepartureReadyReviewItems(storage).length;

  function persist(next: AppStorageState, nextFeedback: SettingsFeedback) {
    writeStorageState(next);
    setStorage(next);
    setDepartureDateValue(next.userSettings.departureDateISO ?? "");
    setFeedback(nextFeedback);
  }

  function saveDepartureDate() {
    const next = cloneStorageState(storage);
    next.userSettings.departureDateISO = departureDateValue || null;

    persist(next, {
      tone: "success",
      message: departureDateValue
        ? `出发日期已保存为 ${departureDateValue}。`
        : "出发日期已清除。"
    });
  }

  function clearDepartureDate() {
    const next = cloneStorageState(storage);
    next.userSettings.departureDateISO = null;

    persist(next, {
      tone: "success",
      message: "出发日期已清除。"
    });
  }

  function exportBackup() {
    const backup = createStorageBackup(readStorageState());
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getStorageBackupFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setFeedback({
      tone: "success",
      message: "学习记录已导出到本地 JSON 备份文件。"
    });
  }

  async function importBackup(file: File | null) {
    if (!file) {
      return;
    }

    const raw = await file.text();
    const next = parseStorageBackup(raw);

    if (!next) {
      setFeedback({
        tone: "danger",
        message: "备份文件无法识别，导入失败。"
      });
      return;
    }

    if (!window.confirm("导入会覆盖当前设备上的学习记录，确认继续吗？")) {
      return;
    }

    persist(next, {
      tone: "success",
      message: "备份已成功导入，当前学习记录已恢复。"
    });
  }

  return (
    <div className="page-stack">
      <PixelCard soft>
        <div className="page-stack" style={{ gap: 12 }}>
          <span className={`badge ${feedback.tone === "success" ? "success" : feedback.tone === "danger" ? "danger" : ""}`.trim()}>
            {feedback.message}
          </span>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">句子总数</span>
              <strong className="stat-value">{totalPhraseCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">已入复习</span>
              <strong className="stat-value">{reviewPoolCount}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">今日复习</span>
              <strong className="stat-value">{dueReviewCount}</strong>
            </div>
          </div>
          <div className="meta-row">
            <span className="badge">
              当前出发日期：{storage.userSettings.departureDateISO ?? "未设置"}
            </span>
            <span className="badge">出发储备：{departureReadyCount}</span>
          </div>
        </div>
      </PixelCard>

      <div className="two-column">
        <PixelCard>
          <div className="page-stack" style={{ gap: 14 }}>
            <div>
              <h2 className="section-title">出发日期</h2>
              <p className="muted" style={{ margin: 0 }}>
                设定日期后，首页会自动显示倒计时、冲刺提醒和每日建议。
              </p>
            </div>
            <div className="field-stack">
              <span className="stat-label">选择日期</span>
              <input
                type="date"
                className="pixel-input"
                value={departureDateValue}
                onChange={(event) => setDepartureDateValue(event.target.value)}
              />
            </div>
            <div className="split-actions">
              <PixelButton onClick={saveDepartureDate}>保存日期</PixelButton>
              <PixelButton variant="ghost" onClick={clearDepartureDate}>
                清除日期
              </PixelButton>
            </div>
          </div>
        </PixelCard>

        <PixelCard>
          <div className="page-stack" style={{ gap: 14 }}>
            <div>
              <h2 className="section-title">学习记录备份</h2>
              <p className="muted" style={{ margin: 0 }}>
                备份文件会包含本机的课程进度、复习记录、收藏和出发日期。
              </p>
            </div>
            <div className="split-actions">
              <PixelButton onClick={exportBackup}>导出学习记录</PixelButton>
              <PixelButton
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                选择备份文件
              </PixelButton>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="pixel-input"
              onChange={(event) => {
                void importBackup(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
            <p className="muted" style={{ margin: 0 }}>
              导入会覆盖当前设备上的记录，请先导出一份本地备份再操作。
            </p>
          </div>
        </PixelCard>
      </div>

      <PixelCard>
        <div className="page-stack" style={{ gap: 14 }}>
          <div>
            <h2 className="section-title">诊断与工具</h2>
            <p className="muted" style={{ margin: 0 }}>
              发音测试已从首页主入口降级到这里，避免打断主学习路径。
            </p>
          </div>
          <div className="split-actions">
            <PixelButton href="/speech-lab" variant="secondary">
              打开发音测试台
            </PixelButton>
            <PixelButton href="/" variant="ghost">
              返回首页
            </PixelButton>
          </div>
        </div>
      </PixelCard>
    </div>
  );
}
