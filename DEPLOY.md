# NIHONGO.GO — Vercel 上线清单 & 交付说明

---

## 一、上线前提条件

| 条件 | 状态 |
|------|------|
| Vercel 账号已注册 | 需确认 |
| GitHub 仓库已创建并推送代码 | 需确认 |
| Azure 账号已注册并创建 Speech 资源（F0 免费层） | 需确认 |

---

## 二、Vercel 部署步骤

### Step 1 — 导入项目

1. 登录 [vercel.com](https://vercel.com)
2. New Project → Import Git Repository → 选择本项目仓库
3. Framework Preset 选 **Next.js**（会自动检测）
4. 不要修改 Build & Output Settings，保持默认

### Step 2 — 配置环境变量（关键）

在 Vercel 项目设置 → **Environment Variables** 中添加：

| Key | Value | Environment |
|-----|-------|-------------|
| `AZURE_SPEECH_KEY` | Azure 门户 → 你的 Speech 资源 → Keys and Endpoint → Key 1 | Production |
| `AZURE_SPEECH_REGION` | 创建 Speech 资源时选择的区域，例如 `japaneast` | Production |

> ⚠️ 这两个值绝对不要提交到 Git。Vercel 环境变量只存在服务端，客户端无法读取。

### Step 3 — 部署

点击 Deploy，等待构建完成（约 1–2 分钟）。

### Step 4 — 绑定域名（可选）

Vercel 会自动分配一个 `xxx.vercel.app` 域名，直接用这个就够了。

---

## 三、iPhone 安装 PWA

1. iPhone Safari 打开 Vercel 分配的网址
2. 点击底部工具栏「分享」按钮（方框加箭头图标）
3. 向下滚动找到「添加到主屏幕」
4. 点击「添加」
5. 完成，桌面出现 NIHONGO.GO 图标，全屏运行

---

## 四、上线烟测清单

按顺序执行，每项确认后打勾：

### 基础功能
- [ ] 首页正常加载，显示 Scene Map 四个场景
- [ ] 进入任意场景，小课列表显示正常
- [ ] 进入 Lesson，四步流程（听→说→读→写→验证）可完整走通
- [ ] Daily Check 在 STEP 5 完成后自动触发
- [ ] 通过 Daily Check 后，首页 Today Review 数字变化

### SRS 复习
- [ ] `/review` 页正常加载
- [ ] 完成至少一句 Daily Check 后，复习队列出现内容
- [ ] AGAIN / HARD / GOOD 三档评分按钮可用
- [ ] 连续两次 AGAIN 触发强化输入框

### 练习模式
- [ ] `/practice` 页范围/题型/数量三步选择正常
- [ ] 严格匹配判题可用，答错进入错题重练轮
- [ ] 练习结束后 SRS 间隔未被改变（Today Review 数字不变）

### 出发模式
- [ ] 收藏一条句子后，首页 Departure Ready 数字 +1
- [ ] `/departure` 页内容只包含收藏和 isCore 句子
- [ ] 错题重练循环正常

### Azure 语音评估
- [ ] 打开任意 Lesson 的 STEP 2，确认显示 `AZURE READY`（需已配环境变量）
- [ ] 录音 → SCORE WITH AZURE → 返回分数
- [ ] 分数 ≥ 75 自动通过进入 STEP 3
- [ ] 断开 Azure（临时删除环境变量重部署）→ 确认降级到手动确认，流程不中断

### iOS PWA 专项
- [ ] Safari 添加到主屏幕后全屏运行，无 Safari 地址栏
- [ ] PWA 状态下录音权限弹窗正常（首次需授权）
- [ ] 日语输入法可正常使用，输入完成后提交无问题

---

## 五、Azure Speech 免费额度说明

| 功能 | 免费额度（F0） | 个人月均用量估算 |
|------|--------------|----------------|
| 语音识别 + 发音评估 | 5 小时 / 月 | ~15–20 分钟 |
| 文字转语音 | 50 万字符 / 月 | 可忽略 |

个人使用远低于免费上限，**不会产生费用**。

---

## 六、日常维护说明

| 事项 | 操作 |
|------|------|
| 新增句子内容 | 编辑 `src/content/scenes/*.json`，push 到 Git，Vercel 自动重新部署 |
| 修改 isCore 标记 | 同上，在对应 JSON 里修改 `isCore: true/false` |
| 查看用量 | Azure 门户 → Speech 资源 → Metrics |
| 学习进度备份 | 浏览器 DevTools → Application → localStorage → 复制 `nihongo-go/storage/v1` 的值 |
| 进度迁移到新设备 | 将上面复制的值粘贴到新设备同一 localStorage key |

---

## 七、已知边界

- 学习进度只存在 localStorage，换浏览器或清除缓存会丢失（手动备份见上）
- 不支持安卓，仅 iPhone Safari 测试过
- Azure 免费层有速率限制，短时间大量请求可能触发 429，重试即可
- 内容 JSON 为静态文件，新增内容需重新部署

---

*文档版本：v1.0 | 2026-03-24*
