# 🎡 LuckyWheel — 幸运转盘

这个程序完全由AI创作，我只是尝试部署它。
一个功能丰富的自定义转盘抽选工具，支持浏览器、Windows (EXE) 和 Android (APK) 使用。

## 🚀 快速开始

### 浏览器使用
直接打开 `index.html` 即可使用，数据保存在浏览器 localStorage 中。

或启动本地服务器：
```bash
npm 安装
npm 启动
```

### 打包为 EXE (Windows)
```bash
npm 安装
npm 运行 electron:build
```
输出文件在 ``dist-electron/`` 目录下。

### 打包为 APK (安卓)
```bash
npm 安装
npm 运行 cap:sync
npm 运行 cap:open:android
```
在 Android Studio 中构建 APK。

> 注意：打包 APK 需要安装 [Android Studio](https://developer.android.com/studio)。

##✨ 功能特性

- 🎨 **自定义转盘** — 自由编辑选项文本、权重和颜色
- 🎯 **权重分区** — 角度按权重分配，最小权重也有足够空间显示文字
- 🔄 **双旋转模式** 🔄 — 转盘旋转或指针旋转
- 🎬 **物理效果** — 指数衰减缓动，停止自然
- 🌙 **深色模式** — 深浅主题切换，自动适配文字颜色
- 📋 **点击禁用** — 点击转盘分区可快速启用/禁用选项
- 🏆 **结果高亮** — 停止后非选中区域降低饱和度，突出结果
- 🚫 **不重复抽取** — 可开启不允许重复模式，已抽选项灰显
- ⏱️ **自定义旋转时间** — 可设置默认旋转时长
- 🎨 **5种配色预设** — 经典多彩、马卡龙、霓虹、海洋、暖色
- 👆 **拖拽旋转** — 鼠标拖拽转盘自由旋转，松手后惯性继续
- ⏸️ **点击停止** — 可在设置中开启，旋转中点击立即停止
- ✋ **长按减速** — 旋转中长按可快速减速
- 📁 **预设系统** — 保存多个转盘组，每个组可包含多个转盘
- 💾 **数据导入导出** — JSON 格式备份和恢复

## 📁 项目结构

```
lucky-wheel/
├── index.html              # 入口页面
├── css/
│   └── style.css           # 样式（含主题变量）
├── js/
│   ├── storage.js          # 数据持久化层
│   ├── theme.js            # 主题管理
│   ├── spin-engine.js      # 旋转物理引擎
│   ├── wheel-renderer.js   # Canvas 转盘绘制
│   ├── ui.js               # UI 组件（设置面板、编辑器、预设管理）
│   └── app.js              # 主应用入口
├── electron/
│   ├── main.js             # Electron 主进程
│   └── preload.js          # 安全桥接
├── assets/                 # 图标等资源
├── package.json
└── capacitor.config.json   # Capacitor 配置（APK）
```

## 🛠️ 技术栈

- **渲染**: HTML5 Canvas 2D
- **框架**: 原生 HTML/CSS/JS（零依赖）
- **主题**: CSS Custom Properties
- **存储**: localStorage
- **动画**: requestAnimationFrame
- **打包**: Electron (EXE) + Capacitor (APK)
