"use client";

import { useJapaneseInput } from "@/lib/ime/use-japanese-input";

export function JapaneseInputLab() {
  const input = useJapaneseInput();

  return (
    <div className="input-lab">
      <p className="muted" style={{ margin: 0 }}>
        这里用 `compositionend` 兜住日语输入法未确定态，后续 Phase 2 的写与验证都会沿用这条输入链。
      </p>
      <textarea
        aria-label="Japanese input lab"
        placeholder="ここに日本語を入力してください"
        {...input.bind}
      />
      <div className="stat-grid">
        <div className="stat-box">
          <span className="stat-label">IME 状态</span>
          <strong className="stat-value">
            {input.isComposing ? "Composing" : "Idle"}
          </strong>
        </div>
        <div className="stat-box">
          <span className="stat-label">实时草稿</span>
          <strong className="stat-value" style={{ fontSize: "1rem" }}>
            {input.value || "—"}
          </strong>
        </div>
        <div className="stat-box">
          <span className="stat-label">提交安全值</span>
          <strong className="stat-value" style={{ fontSize: "1rem" }}>
            {input.committedValue || "—"}
          </strong>
        </div>
      </div>
    </div>
  );
}
