# 传输中心功能文档

## 概述

实现类似百度网盘的"传输中心"功能，用于管理文件的上传和下载任务。

## 状态：✅ 阶段性完成

## 已完成功能

### 上传功能
- [x] 文件上传进度实时追踪
- [x] 上传速度计算和显示
- [x] 批量上传并发控制
- [x] 上传完成后自动移动到历史记录
- [x] 上传失败错误处理和显示

### 下载功能
- [x] 单文件下载进度追踪
- [x] 批量下载进度追踪
- [x] 下载速度计算和显示
- [x] 批量下载并发控制
- [x] 下载完成后自动移动到历史记录

### 传输中心 UI
- [x] 传输页面独立入口（Sidebar 底部）
- [x] 标签页分类：上传中 / 下载中 / 上传完成 / 下载完成
- [x] 任务列表：进度条、速度、文件名、状态
- [x] 历史记录列表：文件名、状态、完成时间
- [x] 活跃任务数量徽章显示
- [x] 清空历史记录功能

## 文件结构

```
src/
├── types/
│   └── transfer.ts          # 传输任务类型定义
├── stores/
│   └── transferStore.ts     # 传输状态管理
├── components/
│   └── transfer/
│       ├── TransferPage.tsx   # 传输页面主组件
│       ├── TransferTabs.tsx   # 标签页切换
│       ├── TaskList.tsx       # 进行中任务列表
│       ├── TaskItem.tsx       # 单个任务项
│       ├── HistoryList.tsx    # 历史记录列表
│       ├── HistoryItem.tsx    # 历史记录项
│       └── index.ts           # 组件导出
└── services/
    └── api.ts                # downloadFileWithProgress 方法
```

## 核心类型

```typescript
// 传输方向
type TransferDirection = 'upload' | 'download'

// 传输状态
type TransferStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error'

// 进行中的任务
interface TransferTask {
  id: string
  direction: TransferDirection
  fileName: string
  filePath: string
  bucketName: string
  fileSize: number
  progress: number      // 0-100
  loadedBytes: number
  speed: number         // B/s
  status: TransferStatus
  startTime: number
}

// 历史记录
interface TransferHistory {
  id: string
  direction: TransferDirection
  fileName: string
  status: 'completed' | 'error'
  startTime: number
  completedAt: number
}
```

## 未来功能（可选）

### 暂停/恢复 + 断点续传

**实现难度：⭐⭐ 简单**

核心机制：记录已传输字节数 → 恢复时发送 `Range` 请求

```typescript
// 暂停
function pause() {
  downloadedBytes = currentBytes
  xhr.abort()
}

// 恢复
function resume() {
  xhr.setRequestHeader('Range', `bytes=${downloadedBytes}-`)
}
```

**区别**：
- 暂停：内存中保存进度
- 断点续传（跨会话）：持久化进度到 localStorage

**预计工作量**：1-2 天
