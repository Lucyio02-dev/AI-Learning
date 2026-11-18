# 发布、校验与回滚

更新日期：2026-11-18。正式站点：<https://lucyio02-dev.github.io/AI-Learning/>。

## 发布链路

GitHub Pages 是正式托管。`.github/workflows/pages.yml` 对同一个提交依次执行：

1. `verify`：复用 `.github/workflows/check.yml`，运行语法检查、自动化回归、Python 语法检查和后端健康检查；
2. `build`：运行 `npm run build:site`，再运行 `npm run verify:release` 校验版本、提交、资源目录和发布边界；
3. `deploy`：只有前两步成功后才上传并部署 `dist/`。

PR 仍由 `check.yml` 独立校验。分支保护是否强制要求该检查通过，属于 GitHub 仓库设置，不能仅凭工作流文件认定已启用。

## 版本身份

一次发布应对应同一组身份：

| 位置 | 字段 |
| --- | --- |
| `package.json` | `version` |
| `src/app/release.js` | `version`、`baseline`、`canonicalUrl` |
| Git 标签与 GitHub Release | `v<version>` |
| 线上 `release.json` | `version`、`commit`、`builtAt`、`assetDirectory` |
| 静态入口 | `index.html` 指向 `releases/<version>-<内容哈希>/` |

`npm run verify:release` 会拒绝版本不一致、提交缺失、资源目录不匹配、入口未指向发布资源或 `dist/` 混入服务端文件的构建。CI 中还会核对 `release.json.commit` 等于 `GITHUB_SHA`；从标签手动部署时核对标签为 `v<version>`。

## 正常发布

```sh
npm run check
npm test
npm run pycheck
npm run build:site
npm run verify:release
```

通过功能分支和 PR 合并到 `main`。Pages 完成部署后，核对：

```sh
curl -fsS https://lucyio02-dev.github.io/AI-Learning/release.json
git rev-parse HEAD
```

两处 `commit` 应一致。随后在已验证的提交上创建 `v<version>` 标签和 Release，不把“Action 绿色”代替浏览器功能验收。

## 回滚

发布不保留服务器端历史目录，回滚通过重新部署已验证提交完成：

```sh
gh workflow run pages.yml --ref v3.1.0
```

也可以从旧版本创建分支、提交一个恢复 PR，经同一校验链路合并。两种方式都必须确认：

- 线上 `release.json.commit` 等于回滚目标提交；
- 首页、一门课程和一个实验室可打开；
- 浏览器 localStorage 中的 `ai-learning-lab-v3` 未被清除；
- 旧 Service Worker 退役脚本仍存在，深层课程地址可恢复。

## 备用静态托管

Netlify 与 Vercel 配置均执行 `npm run build:site` 并只发布 `dist/`，可作为备用静态托管；正式地址、文档和 `canonicalUrl` 仍以 GitHub Pages 为准。不得发布仓库根目录，也不得把 `server/`、`experiments/` 或数据目录带入静态产物。

## 尚未自动化的外部条件

- 仓库分支保护与必需检查：需在 GitHub 仓库设置中确认。
- 自定义域名、CDN 与证书：当前未使用。
- 真实线上模型、embedding、Python 任务和跨设备同步：需要独立计算服务，不能由静态 Pages 发布证明。
