# AI大学习平台

这是一个零依赖纯前端网页应用，结合 Lordog/dive-into-llms 的章节主题搭建学习工作台。部署到公网后，其他用户可以通过电脑或手机浏览器访问同一个网址。

## 使用方式

开发预览时可以直接用浏览器打开 `index.html`。正式给其他人使用时，把整个目录发布到任意静态托管平台。

## 发布到公网

### GitHub Pages

1. 创建一个 GitHub 仓库并上传本目录所有文件。
2. 进入仓库 `Settings` -> `Pages`。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/root`。
5. 保存后等待生成访问地址。

### Netlify

1. 新建站点并连接仓库，或直接拖拽整个项目目录。
2. Build command 留空。
3. Publish directory 填 `.`。

### Vercel

1. 导入仓库。
2. Framework Preset 选择 `Other`。
3. Build Command 留空。
4. Output Directory 填 `.`。

## 功能

- 学习路线：按《动手学大模型》章节组织 11 个模块。
- 实践实验：每个模块提供实践任务、命令复制和实验记录。
- 电子书：内置在线资料入口，并支持用户在浏览器里预览自己设备上的 PDF。
- 课程视频：内置课程入口，支持添加视频链接和播放用户自己设备上的视频文件。
- 学习笔记：按模块记录笔记、标签和更新时间，支持导出 Markdown。
- 数据备份：进度、笔记、实践记录和自定义视频链接保存在浏览器 localStorage，可导出或导入 JSON。

## 数据说明

这是纯前端网页，没有服务器数据库。每个用户的进度、笔记和自定义视频链接默认只保存在自己浏览器的 localStorage 中。PDF 和本机视频只在用户当前浏览器里打开，不会上传给网站，也不会共享给其他用户。

如果需要多人账号、云端同步、统一课程后台、上传资料库，需要再接入后端服务和数据库。

## 资料来源

- https://github.com/Lordog/dive-into-llms
- https://hiascend.com/developer/courses/detail/1578542990315864066
