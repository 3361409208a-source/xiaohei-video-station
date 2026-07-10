# TODOS.md — 小黑搜影 待办事项

> 来源: /plan-ceo-review + /plan-eng-review (2026-07-10) + 全站 /plan-eng-review (2026-07-10)
>
> 优先级已按 2026-07-10 二次校准：**安全 / SEO 优先于广告增长**。
> 本文件所列 P0–P3 项已于 2026-07-10 全部落地。

---

## P0 — 立刻修（安全）

### T-P0-1: 修复管理员密码前端泄露（原 T-P1-1）✅ 已完成
- **Status**: 已完成（2026-07-10）
- **What**: 移除前端硬编码密码；`ADMIN_PASSWORD` 改读环境变量；首页改用公开 `/api/stats`；Admin 登录改为后端校验
- **Files**: `src/app/page.js`, `src/app/admin/AdminClient.js`, `src/app/api/stats/route.js`, `main.py`, `DEPLOYMENT.md`

---

## P1 — 立刻修（SEO / 收录）

### T-P1-SEO-1: 修复 Sitemap URL 字段错配（新增）✅ 已完成
- **Status**: 已完成（2026-07-10）
- **Files**: `src/app/sitemap/[id]/route.js`, `src/utils/sitemapUrl.js`, `main.py`

### T-P1-SEO-2: 消除详情 soft 404 + 基础 SEO 信号（新增）✅ 已完成
- **Status**: 已完成（2026-07-10）
- **Files**: `src/app/movie/[slug]/page.js`, `src/app/layout.js`

---

## P2 — 应该做（正确性 + 增长）

### T-FULL-1: 统一 backupService.js 与 main.py 分类匹配逻辑 ✅ 已完成
- **Status**: 已完成（2026-07-10）
- **What**: `category_rules.json` + `src/data/category_rules.json`；`build_category_where` / `matchCategory` / `mapToMajorCategory`；删除重复 `/api/search`
- **Files**: `category_rules.json`, `src/data/category_rules.json`, `src/utils/categoryRules.js`, `src/utils/backupService.js`, `main.py`

### T-P2-1: 搜索趋势首页展示 ✅ 已完成
- **Status**: 已完成（2026-07-10）
- **What**: 公开 `GET /api/trends`；首页热搜动态加载，失败回退硬编码
- **Files**: `main.py`, `src/app/api/trends/route.js`, `src/app/page.js`

### T-P2-2: 播放页「猜你喜欢」推荐 ✅ 已完成
- **Status**: 已完成（2026-07-10）
- **Files**: `src/components/Recommendations.js`, `src/app/movie/[slug]/MoviePlayer.js`

### T-P2-3 + T-P3-2: AdSlot 备用位 / 多联盟回退 ✅ 已完成
- **Status**: 已完成（2026-07-10）
- **What**: config 驱动 AdSlot，默认 `ads.enabled=false`；script 失败 / bait 拦截后回退 image；无「请关闭广告拦截」弹窗
- **Files**: `config.json`, `src/components/AdSlot.js`, `src/utils/adFallback.js`, `src/app/page.js`, `MoviePlayer.js`, `main.py` `/api/config`

### T-FULL-3: 搭建 Vitest 测试框架 + 关键路径测试 ✅ 已完成
- **Status**: 已完成（2026-07-10）
- **What**: `npm test` → 11 个用例（分类、sitemap URL、SSRF、AdSlot 回退、规则双份同步）
- **Files**: `vitest.config.js`, `src/__tests__/critical-paths.test.js`, `package.json`

### T-P2-4: ~~/api/proxy SSRF 防护~~ ✅ 已完成
- **Status**: 已完成（2026-07-10）— 原归档 T2，现已落地
- **Files**: `src/utils/proxySafety.js`, `src/app/api/proxy/route.js`

---

## P3 — 可以做（长期 / 工程债）

### T-P3-1: 追踪数据定期清理策略 ✅ 已完成
- **Status**: 已完成（2026-07-10）
- **What**: trends 截断 Top 50 + SQLite VACUUM；Admin「数据清理」按钮
- **Files**: `main.py` (`/api/admin/cleanup`), `src/app/api/admin/cleanup/route.js`, `AdminClient.js`

### T-FULL-2: AdminClient.js 和 MoviePlayer.js 重构为 CSS Module ✅ 已完成
- **Status**: 已完成（2026-07-10）
- **Files**: `src/app/admin/admin.module.css`, `src/app/admin/AdminClient.js`, `src/app/movie/[slug]/movie-player.module.css`, `MoviePlayer.js`

---

## 业务正确性修复（2026-07-10 第二轮）✅ 已完成

| 项 | 内容 |
|---|---|
| 详情 null 兜底 | `/api/detail` 遇 FastAPI `null` 走 backupService |
| 代理统一 | MoviePlayer 始终走同源 Next `/api/proxy`（SSRF） |
| FastAPI SSRF | `main.py` `/api/proxy` 增加私网拦截 |
| 搜索多源 | 去重键改为 `title::source_name` |
| Fallback 分页 | backupService 频道按 `pg` 真 slice |
| Admin 统计 | 初始统计改拉 `/api/stats`，不再读空 JSON |
| Admin 影片库 | 子类 → `mapToMajorCategory` + `class_tag` |
| DB 唯一键 | `UNIQUE(vod_id, source_name)` + 启动迁移 |
| `/play` 遗留 | 重定向到 `/movie/{title}-{id}` |

---

## 上线注意

1. 后端必须设置环境变量 `ADMIN_PASSWORD`
2. 广告：在 `config.json` 填入联盟 script 后将 `ads.enabled` 设为 `true`
3. 跑测试：`npm test`
4. 重启 FastAPI 以触发 DB 唯一键迁移（若仍是旧 `UNIQUE(title, source_name)`）
