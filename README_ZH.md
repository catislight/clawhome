<div align="center">
  <img src="resources/logo.png" alt="openclaw-console logo" width="64" />
  <h1>clawhome</h1>

  ---

  <p><a href="./README.md">English</a> | <strong>中文</strong></p>

 <p align="center">
  <img src="https://img.shields.io/badge/platform-MacOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-40+-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

  <br/>

  **🖥️ 一个面向 OpenClaw 的多实例管理桌面端应用：支持统一管理多个本地与远程 OpenClaw 实例，把连接、会话、调度与运维集中到一个工作台。**

  [上手使用](#-上手使用3-分钟完成) · [支持功能](#-支持功能) · [界面截图](#-界面截图)
</div>

![openclaw-console chat](images/chat.png)

## ✨ 支持功能

- `多实例统一管理`：同时管理多个本地与远程 OpenClaw 实例，快速切换工作上下文。
- `连接与鉴权集中配置`：支持 `SSH` / `Local Direct`，统一维护 Gateway 地址与认证信息。
- `一站式控制台`：在同一应用内完成对话、Skills、Agents、Cron、日志与终端操作，不再来回切工具。
- `任务调度自动化`：内置 Cron 管理，支持创建、编辑、启停、手动执行与历史回看。
- `排障与观测`：提供调试日志、会话运行轨迹和内置终端，便于快速定位连接与执行问题。
- `全局配置管理`：支持模型/工具等全局配置（表单 + JSON）以及语言与发送快捷键偏好设置。

## 🚀 上手使用（3 分钟完成）

1. 打开应用后先进入**实例管理**，创建你的第一个 OpenClaw 实例。
2. 根据部署方式选择连接类型：
   - 本机部署选 `Local Direct`
   - 远程机器选 `SSH`
3. 填写并保存连接信息，确认实例状态变为可用。
4. 进入对话页，选择目标实例开始提问或执行任务。
5. 按需进入 `Cron`、`Skills`、`Agents`、`Logs`、`Terminal` 页面完成调度、能力配置与排障。

## 🧩 你可以这样用

- `同时管理多个环境`：本地开发实例 + 远程测试/生产实例统一接入，一个应用里完成切换。
- `减少重复配置`：连接、鉴权与全局参数集中维护，不用每次重复配置。
- `快速定位问题`：当实例异常时，直接查看日志与终端，缩短排障链路。
- `把日常任务自动化`：把固定操作放进 Cron，避免手工重复执行。
- `统一团队操作入口`：对话、技能、Agent 配置都在同一个界面，协作路径更一致。

## 🖼 界面截图

| 实例管理 | 对话中心 |
| --- | --- |
| ![实例管理](images/instancemanagement.png) | ![对话中心](images/chat.png) |

| Cron 调度 | Skills 中心 |
| --- | --- |
| ![Cron 调度](images/schedules.png) | ![Skills 中心](images/skills.png) |

| Agents 中心 | 全局配置中心 |
| --- | --- |
| ![Agents 中心](images/agents.png) | ![全局配置中心](images/globalconfig.png) |

| 知识库 | 终端 |
| --- | --- |
| ![知识库](images/library.png) | ![终端](images/terminal.png) |
