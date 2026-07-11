# 家中酒柜 PWA

一个轻量网页/PWA 原型，用来记录家里的酒和材料，并根据“想喝的感觉”随机生成调酒配方。

## 怎么用

本地预览：

```bash
cd /Users/asukavv/Documents/Codex/2026-07-07/wo-xi/outputs/HomeBarPWA
python3 -m http.server 4173
```

然后打开：

```text
http://localhost:4173
```

## 功能

- 记录酒柜材料，数据保存在浏览器本地。
- 输入酒或材料名称后，可用公开百科资料自动推荐分类和味道标签。
- 输入灵感和味道方向，生成配方。
- 收藏喜欢的配方。
- 支持离线缓存和添加到主屏幕。

如果浏览器之前打开过旧版本，刷新后仍看不到新按钮，可以访问：

```text
http://localhost:4173/index.html?v=34
```

## 下一步

- 接入 AI 接口，让配方更有表达力。
- 加库存剩余量和“快过期/优先消耗”。
- 增加分享卡片和二维码。

## 部署

这个目录已经整理成可部署的静态站点。可以直接部署到 Vercel、Netlify 或 Cloudflare Pages。

详细步骤见：

```text
DEPLOY.md
```
