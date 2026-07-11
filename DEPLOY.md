# 部署说明

这个目录是一个纯静态 PWA，不需要构建步骤。部署时把整个 `outputs/HomeBarPWA` 目录作为站点根目录即可。

## Vercel

1. 新建项目。
2. 选择这个目录作为项目目录。
3. Framework 选择 `Other`。
4. Build Command 留空。
5. Output Directory 留空或填 `.`。
6. 部署后打开生成的网址。

## Netlify

1. 新建站点。
2. Publish directory 填 `.`。
3. Build command 留空。
4. 部署后打开生成的网址。

## Cloudflare Pages

1. 新建 Pages 项目。
2. Framework preset 选择 `None`。
3. Build command 留空。
4. Build output directory 填 `/` 或 `.`。

## 本地预览

```bash
cd outputs/HomeBarPWA
python3 -m http.server 4173
```

打开：

```text
http://localhost:4173
```

## 注意

- 酒柜和收藏数据保存在每个用户自己的浏览器本地。
- 自动标签会从公开百科接口读取信息；如果用户网络环境拦截该接口，仍然可以手动选择标签。
- 更新线上版本后，如果朋友看不到新内容，让他刷新页面或重新打开网址。
