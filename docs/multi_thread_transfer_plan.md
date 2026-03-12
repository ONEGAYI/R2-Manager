# 多线程分块传输技术方案

> 调研日期：2026-03-11
> 最后更新：2026-03-12
> 状态：Phase 1 下载/上传 + Phase 2 暂停/恢复 均已完成
> 目标：实现断点续传 + 多线程分块下载 + 多线程分块上传

---

## 性能优化记录

### 2026-03-12 上传暂停/恢复功能

**功能**：实现分块上传的暂停和恢复功能

**实现方案**：
- **暂停机制**：通过 `activeXhrs` Map 追踪所有活跃的 XHR 请求
  - 调用 `pause()` 时中断所有活跃 XHR
  - 重置未完成分块的 `loadedBytes` 为 0
  - 返回 `ChunkedUploaderState` 用于持久化
- **状态持久化**：`pausedUploads` 数组存储到 Zustand store
  - 包含 uploadId、completedParts、partSize 等关键信息
  - 自动持久化到 localStorage/文件系统
- **恢复机制**：从服务器获取真实已上传分块
  - 调用 `ListParts` API 获取 S3/R2 上的实际分块状态
  - 跳过已完成的分块，只上传剩余部分
  - 会话过期检测（24小时限制）

**新增后端 API**：
- `GET /api/buckets/:bucket/objects/:key/multipart/parts?uploadId=xxx`
- 返回已上传分块列表 + isExpired 状态

**新增类型定义**：
- `ChunkedUploaderState` - 上传器完整状态
- `PausedUploadState` - 暂停任务持久化格式
- `ListPartsResponse` - 服务端分块查询响应
- `ResumeOptions` - 恢复上传配置

### 2026-03-12 进度报告节流优化

**问题**：下载时 CPU 所有核心占用高，进度更新过于频繁导致 React 重新渲染过多

**解决方案**：
- 添加 `lastReportTime` 变量跟踪上次报告时间
- 新增 `PROGRESS_THROTTLE_MS = 200` 节流间隔
- 使用 `reportProgressThrottled()` 替代直接调用 `reportProgress()`
- 确保最终进度（100%）始终报告

**效果**：
| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 进度日志数量 | ~40+ 条 | ~17 条 | 减少 60% |
| 下载时间（225MB） | 25秒 | 16秒 | 快 36% |

---

## 实施进度

### ✅ Phase 1 下载：基础分块下载（已完成 2026-03-12）

**已实现的文件**：

| 文件 | 职责 |
|------|------|
| `src/types/chunk.ts` | 分块类型定义（ChunkInfo、ChunkDownloadResult、ChunkStrategy） |
| `src/lib/chunkManager.ts` | 分块计算逻辑（calculateChunks、createRangeHeader、shouldUseChunkedDownload） |
| `src/lib/transferLogger.ts` | 传输日志模块（任务/分块日志、进度节流） |
| `src/services/chunkedDownload.ts` | 分块下载核心实现（ChunkedDownloader 类） |
| `server/index.js` | 后端 Range 请求支持（206 Partial Content） |
| `src/App.tsx` | 前端集成（handleDownload 根据文件大小选择下载方式） |

**核心功能**：
- [x] 分块计算逻辑（1/2/4/8 块策略）
- [x] 单任务多线程下载
- [x] 分块合并（Blob 合并）
- [x] 基础日志（transferLogger）
- [x] 后端 Range 请求支持
- [x] 进度报告节流（200ms 间隔，减少 CPU 占用）

**分块策略**：
| 文件大小 | 分块数 | 说明 |
|----------|--------|------|
| < 10MB | 1 | 不分块，使用原有单线程下载 |
| 10-50MB | 2 | 2 分块并发 |
| 50-200MB | 4 | 4 分块并发 |
| \> 200MB | 8 | 8 分块并发 |

### ✅ Phase 1 上传：S3 Multipart Upload（已完成 2026-03-12）

**已实现的文件**：

| 文件 | 职责 |
|------|------|
| `src/types/chunk.ts` | 扩展上传类型（ChunkUploadInfo、CompletedPart、MultipartUploadSession） |
| `src/lib/abortRegistry.ts` | **新建** - Abort 函数注册表（真取消机制） |
| `src/lib/transferLogger.ts` | 扩展上传日志方法（uploadInitiated、uploadPartStarted 等） |
| `src/services/chunkedUpload.ts` | **新建** - ChunkedUploader 类（S3 Multipart Upload） |
| `src/stores/transferStore.ts` | 修改 cancelTask 调用真取消（abortTask） |
| `server/index.js` | 新增 4 个 Multipart API 端点 |
| `src/App.tsx` | 前端集成（handleUpload 根据文件大小选择上传方式） |

**核心功能**：
- [x] S3 Multipart Upload API 集成
- [x] 分块并发上传（XHR 进度追踪）
- [x] 真取消机制（AbortMultipartUpload 清理已上传分块）
- [x] 分块大小：10MB（自动调整确保不超过 10000 分块限制）
- [x] 后端 4 个 API 端点
- [x] 暂停/恢复功能（Phase 2）

**后端 API 端点**：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/buckets/:bucket/objects/:key/multipart/initiate` | POST | 初始化分块上传，返回 UploadId |
| `/api/buckets/:bucket/objects/:key/multipart/upload-part` | POST | 上传单个分块，返回 ETag |
| `/api/buckets/:bucket/objects/:key/multipart/complete` | POST | 合并所有分块 |
| `/api/buckets/:bucket/objects/:key/multipart/abort` | POST | 取消上传，清理已上传分块 |

**上传流程**：
```
1. InitiateMultipartUpload → 获取 UploadId
2. UploadPart (并发) → 每个 Part 返回 ETag
3. CompleteMultipartUpload → 合并所有 Part
4. AbortMultipartUpload (取消时) → 清理已上传分块
```

**真取消机制**：
```typescript
// 全局 abort 函数注册表
const abortRegistry = new Map<string, () => void>()

// 注册 abort 函数
registerAbortFn(taskId, () => uploader.abort())

// 取消任务（真取消）
cancelTask: (id) => {
  abortTask(id)  // 调用 ChunkedUploader.abort() 或 XHR.abort()
  // ... 更新状态
}
```

### ✅ 测试验证已完成（2026-03-12）

**测试环境**: Windows 11, Chrome, localhost:5173

**测试结果**: 所有核心功能正常工作

#### 1. 后端 Range 请求测试 ✅
```bash
# 完整请求
curl -I http://localhost:3001/api/buckets/test/objects/file.bin/download

# Range 请求（应返回 206 状态码和 Content-Range 头）
curl -I -H "Range: bytes=0-1023" http://localhost:3001/api/buckets/test/objects/file.bin/download
```

**预期结果**：
- 完整请求：200 状态码，返回 `Accept-Ranges: bytes` 头
- Range 请求：206 状态码，返回 `Content-Range: bytes 0-1023/xxx` 头

**验证结果**: 通过前端分块下载测试间接验证，后端 Range 请求正常工作

#### 2. 前端下载功能测试
1. 启动开发服务器：`npm run dev`
2. 上传不同大小的测试文件到 R2
3. 下载文件，观察浏览器控制台日志

**测试用例**：

| 测试项 | 文件大小 | 预期行为 | 验证方法 | 测试结果 |
|--------|----------|----------|----------|----------|
| 小文件下载 | < 10MB | 单线程下载 | 控制台显示 `Using single-thread download mode` | ✅ 通过 |
| 中文件下载 | 10-50MB | 2 分块下载 | 控制台显示 `Using chunked download mode, chunkCount: 2` | ✅ 通过 |
| 大文件下载 | 50-200MB | 4 分块下载 | 控制台显示 `chunkCount: 4` | 待测试 |
| 超大文件下载 | > 200MB | 8 分块下载 | 控制台显示 `chunkCount: 8` | ✅ 通过 |
| 进度显示 | 任意 | 实时更新进度条 | UI 进度条同步更新 | ✅ 通过 |
| 下载完成 | 任意 | 文件完整 | 下载后校验 MD5 或文件大小 | ✅ 通过 |

**关键日志检查**：
```
[Transfer] Task created: xxx { fileName: '...', fileSize: '...' }
[Transfer] Using chunked download mode { fileSize: '...', chunkCount: 4, concurrency: 4 }
[Transfer] Chunk 0 started { range: '0 - 12.5 MB' }
[Transfer] Chunk 1 started { range: '12.5 MB - 25 MB' }
[Transfer] Progress: xxx { percent: '52.3%', loaded: '26.15 MB', ... }
[Transfer] Chunk 0 completed { size: '12.5 MB' }
[Transfer] Merge completed { totalSize: '50 MB' }
[Transfer] Task completed: xxx { duration: '12.34s' }
```

#### 3. 前端上传功能测试 ✅

**测试结果**（2026-03-12）：
- 上传 230MB 文件，自动分为 23 个分块
- 4 线程并发上传正常
- 进度实时更新
- 最终合并成功

**关键日志检查**：
```
[Transfer] Task created: xxx { fileName: 'huge.7z', fileSize: '230.00 MB' }
[Transfer] Multipart upload initiated { uploadId: '...', taskId: '...' }
[Transfer] Using chunked upload mode { fileSize: '230.00 MB', partCount: 23, concurrency: 4 }
[Transfer] Part 1 upload started { range: '0 - 10 MB' }
[Transfer] Part 2 upload started { range: '10 MB - 20 MB' }
[Transfer] Part 3 upload started { range: '20 MB - 30 MB' }
[Transfer] Part 4 upload started { range: '30 MB - 40 MB' }
...
[Transfer] Part 1 upload completed { size: '10.00 MB' }
[Transfer] Part 5 upload started { range: '40 MB - 50 MB' }
...
[Transfer] Completing multipart upload with 23 parts...
[Transfer] Multipart upload completed { key: 'test/huge.7z', location: '...' }
[Transfer] Task completed: test/test/huge.7z { duration: '183.00s' }
```

#### 4. 性能对比测试 ✅
- 对比单线程 vs 多线程下载速度
- 预期：大文件下载速度提升 2-4 倍
- **实测结果**: 225MB 文件使用 8 分块并发下载，约 25 秒完成

#### 5. 边界情况测试（待后续验证）
- [ ] 网络中断后重新下载
- [ ] 下载过程中切换页面
- [ ] 同时下载多个大文件
- [ ] 上传过程中取消（验证 AbortMultipartUpload）

### ✅ Phase 2 上传：暂停/恢复功能（已完成 2026-03-12）

**已实现的文件**：

| 文件 | 职责 |
|------|------|
| `src/services/chunkedUpload.ts` | ChunkedUploader 增强（pause/resume/listPartsFromServer） |
| `src/stores/transferStore.ts` | 暂停状态持久化（pausedUploads、pauseTask/resumeTask） |
| `src/App.tsx` | 暂停/恢复处理函数（handlePauseUpload、handleResumeUpload） |
| `src/types/chunk.ts` | 新增类型（ChunkedUploaderState、PausedUploadState、ListPartsResponse） |
| `src/components/transfer/TaskItem.tsx` | 排队任务取消按钮 |
| `src/components/transfer/TransferPage.tsx` | 暂停/恢复回调传递 |
| `src/lib/transferLogger.ts` | 暂停/恢复相关日志 |
| `server/index.js` | 新增 ListParts API 端点 |

**核心功能**：
- [x] 暂停时中断活跃 XHR 请求（通过 `activeXhrs` Map 追踪）
- [x] 暂停状态持久化到 store（pausedUploads 数组）
- [x] 恢复时从服务器获取已上传分块（ListParts API）
- [x] 跳过已完成的分块继续上传
- [x] 会话过期检测（S3 Multipart Upload 24小时限制）
- [x] 排队任务支持取消

**后端 API 端点**：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/buckets/:bucket/objects/:key/multipart/parts?uploadId=xxx` | GET | 查询已上传分块，检测会话过期 |

**暂停/恢复流程**：
```
暂停流程：
1. 用户点击暂停 → handlePauseUpload()
2. uploader.pause() → 中断所有活跃 XHR
3. 返回 ChunkedUploaderState → 保存到 pausedUploads
4. 更新任务状态为 paused

恢复流程：
1. 用户点击恢复 → handleResumeUpload()
2. 从 store 获取 pausedUploadState
3. ListParts API 验证会话 + 获取已上传分块
4. 创建新 ChunkedUploader，传入 ResumeOptions
5. uploader.start(resumeOptions) → 跳过已完成分块
6. 完成后清理暂停状态
```

**会话过期处理**：
- S3 Multipart Upload 会话有效期为 24 小时
- 恢复时调用 ListParts API 检测 `NoSuchUpload` 错误
- 会话过期时提示用户重新上传

**测试验证**（2026-03-12）：
- 暂停功能：正常中断 XHR，状态正确保存
- 恢复功能：从服务器获取分块，跳过已完成部分
- 会话过期：ListParts 返回 isExpired，UI 显示错误提示
- UI 状态：暂停任务正确显示在上传中列表

### 🔲 Phase 3：全局线程池（未开始）
- [ ] 线程池实现
- [ ] 多任务资源分配
- [ ] 配置热更新支持

### 🔲 Phase 4：优化与测试（未开始）
- [ ] 错误重试机制
- [ ] 进度条优化
- [ ] 边界情况测试
- [ ] 性能优化

---

## 1. 核心问题分析

### 1.1 用户提出的疑问

| 问题 | 核心矛盾 |
|------|----------|
| 暂停后如何处理已切块？ | 动态切块 vs 静态切块 |
| 切块信息存储负担？ | 存储空间 vs 恢复能力 |
| 历史记录覆盖风险？ | 持久化策略 |
| 多任务资源竞争？ | 全局线程池管理 |
| 进度条如何真实反映？ | 分块乱序完成 |
| 线程数设置不匹配？ | 2线程 vs 8分块 |
| 暂停后更改设置？ | 配置热更新 |

### 1.2 场景矩阵

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   场景      │  单任务     │  多任务     │  暂停/恢复  │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ 小文件(<10M)│ 单线程      │ 并行任务    │ 不需要断点  │
│ 中文件(<100M)│ 2-4线程    │ 任务排队    │ 简单断点    │
│ 大文件(>100M)│ 4-8线程    │ 限制并发    │ 分块断点    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

---

## 2. 分块策略设计

### 2.1 静态分块 vs 动态分块

```
静态分块（采用）:
┌────────────────────────────────────────┐
│ 开始下载时一次性计算所有分块            │
│ 分块信息固定，暂停/恢复时直接使用        │
│ 优点：简单、可靠、易持久化              │
│ 缺点：无法根据网速动态调整              │
└────────────────────────────────────────┘
```

### 2.2 分块策略与线程数的关系

**核心原则**：分块数 ≠ 线程数

```
分块数：由文件大小决定（存储单位）
线程数：由用户配置决定（并发限制）

示例：
- 文件 200MB → 分成 8 块（每块 25MB）
- 用户设置 2 线程 → 同时只下载 2 块
- 用户设置 16 线程 → 最多同时下载 8 块（受限于分块数）
```

| 文件大小 | 分块数 | 每块大小 | 说明 |
|----------|--------|----------|------|
| < 10MB | 1 | - | 不分块 |
| 10-50MB | 2 | 5-25MB | |
| 50-200MB | 4 | 12.5-50MB | |
| > 200MB | 8 | 25MB+ | |

```typescript
// 分块策略（仅基于文件大小）
function calculateChunks(fileSize: number): ChunkInfo[] {
  const CHUNK_SIZE = 5 * 1024 * 1024  // 基础分块 5MB
  const MIN_CHUNKS = 1
  const MAX_CHUNKS = 8

  // 根据文件大小计算分块数
  let chunkCount = Math.ceil(fileSize / CHUNK_SIZE)
  chunkCount = Math.max(MIN_CHUNKS, Math.min(MAX_CHUNKS, chunkCount))

  // 生成各分块信息
  const chunkSize = Math.ceil(fileSize / chunkCount)
  const chunks: ChunkInfo[] = []

  for (let i = 0; i < chunkCount; i++) {
    chunks.push({
      index: i,
      start: i * chunkSize,
      end: Math.min((i + 1) * chunkSize - 1, fileSize - 1),
      loadedBytes: 0,      // 已下载字节数（用于进度）
      completed: false,
    })
  }

  return chunks
}
```

### 2.3 进度条显示逻辑

**问题**：分块可能乱序完成（比如块2先于块1完成）

**解决方案**：基于总字节数而非块序号

```typescript
interface ChunkProgress {
  taskId: string
  totalBytes: number           // 文件总大小
  completedBytes: number       // 已完成总字节数
  chunks: {
    index: number
    loadedBytes: number        // 该块已下载字节数
    completed: boolean
  }[]
}

// 计算总进度（0-100）
function calculateProgress(progress: ChunkProgress): number {
  const totalLoaded = progress.chunks.reduce(
    (sum, c) => sum + c.loadedBytes,
    0
  )
  return Math.round((totalLoaded / progress.totalBytes) * 100)
}

// UI 显示
// 进度条: ████████░░░░░░░░ 52%
// 速度: 2.5 MB/s
// 分块状态: [✓] [✓] [↓ 60%] [○]  ← 可选显示
```

### 2.4 配置热更新处理

**问题**：用户暂停后更改线程数设置

**方案**：线程池实时响应配置变化，但分块不变

```
场景：
1. 开始下载：8分块，用户设置4线程
2. 下载中... 块1完成，块2下载50%
3. 用户暂停，将线程改为2
4. 恢复下载：仍用8分块，但只用2线程下载剩余6块

结论：
- 分块策略：创建时确定，不会改变
- 线程限制：实时读取最新配置
- 恢复时：跳过已完成分块，用当前线程数下载剩余
```

```typescript
// 线程池实时读取配置
class DownloadThreadPool {
  private get maxThreads(): number {
    // 每次都从 store 读取最新值
    return useConfigStore.getState().maxDownloadThreads
  }

  // ... 其他逻辑
}
```

---

## 3. 进度持久化方案

### 3.1 存储位置

**采用方案B**：独立 `pending-transfers.json` 存储

```
┌─────────────────────────────────────────────────────┐
│ pending-transfers.json                              │
│ - 单独的 localStorage / 文件                        │
│ - 只保存未完成任务                                  │
│ - 与 history 完全隔离                               │
└─────────────────────────────────────────────────────┘
```

### 3.2 数据结构

```typescript
// 分块信息
interface ChunkInfo {
  index: number          // 分块序号
  start: number          // 起始字节
  end: number            // 结束字节
  loadedBytes: number    // 已下载字节数（关键！）
  completed: boolean     // 是否已完成
  tempPath?: string      // 临时文件路径（Tauri）
}

// 进行中任务
interface PendingTransferTask {
  id: string
  direction: 'upload' | 'download'

  // 基础信息
  fileName: string
  filePath: string
  bucketName: string
  fileSize: number
  presignedUrl?: string  // 预签名URL（可能过期）

  // 分块信息（核心）
  chunks: ChunkInfo[]

  // 进度信息
  completedBytes: number
  startTime: number
  status: 'pending' | 'running' | 'paused'

  // 临时文件路径（Tauri 桌面端）
  tempDir?: string
}

// 存储结构
interface PendingTransferStorage {
  version: number  // 数据版本，便于迁移
  tasks: Record<string, PendingTransferTask>
}
```

### 3.3 暂停时如何保存进度

**每个分块独立保存进度**

```typescript
// 暂停任务
async function pauseTask(taskId: string): Promise<void> {
  const task = pendingStore.getTask(taskId)

  // 1. 取消所有进行中的 XHR 请求
  for (const xhr of activeXhrs.get(taskId) || []) {
    xhr.abort()
  }

  // 2. 保存每个分块的精确进度
  const updatedChunks = task.chunks.map(chunk => ({
    ...chunk,
    // 如果正在下载中，loadedBytes 就是当前进度
    // 如果已完成，loadedBytes = end - start + 1
  }))

  // 3. 更新持久化存储
  await pendingStore.updateTask(taskId, {
    status: 'paused',
    chunks: updatedChunks,
    completedBytes: calculateTotalLoaded(updatedChunks)
  })

  logger.info(`[Transfer] Task ${taskId} paused`, {
    chunks: updatedChunks.map(c => ({
      index: c.index,
      loaded: c.loadedBytes,
      total: c.end - c.start + 1,
      percent: Math.round(c.loadedBytes / (c.end - c.start + 1) * 100)
    }))
  })
}
```

### 3.4 恢复时如何续传

**只下载未完成的部分**

```typescript
// 恢复任务
async function resumeTask(taskId: string): Promise<void> {
  const task = pendingStore.getTask(taskId)

  // 1. 检查预签名URL是否过期
  if (isUrlExpired(task.presignedUrl)) {
    task.presignedUrl = await getPresignedUrl(task.bucketName, task.filePath)
  }

  // 2. 找出未完成的分块
  const pendingChunks = task.chunks.filter(c => !c.completed)

  logger.info(`[Transfer] Resuming task ${taskId}`, {
    totalChunks: task.chunks.length,
    completedChunks: task.chunks.filter(c => c.completed).length,
    pendingChunks: pendingChunks.length
  })

  // 3. 提交到线程池（使用当前线程数配置）
  for (const chunk of pendingChunks) {
    threadPool.submitChunk({
      taskId,
      chunk,
      rangeStart: chunk.start + chunk.loadedBytes,  // 关键：从断点继续
      rangeEnd: chunk.end,
      onProgress: (loaded) => {
        chunk.loadedBytes = loaded
        updateTotalProgress(taskId)
      },
      onComplete: () => {
        chunk.completed = true
        chunk.loadedBytes = chunk.end - chunk.start + 1
        savePendingTask(taskId)  // 实时保存
      }
    })
  }
}
```

### 3.5 存储位置

| 环境 | 存储位置 | 文件名 |
|------|----------|--------|
| 浏览器 | localStorage | `r2-manager-pending` |
| Tauri | Documents 目录 | `pending-transfers.json` |

### 3.6 生命周期管理

```
任务创建 → 写入 pending 存储
分块进度更新 → 节流更新 pending（每秒最多1次）
任务暂停 → 立即保存当前状态
任务恢复 → 从 pending 读取，继续下载
任务完成 → 从 pending 删除 → 移动到 history
任务取消 → 从 pending 删除（可选保留临时文件）
```

---

## 4. 资源竞争与线程管理

### 4.1 全局线程池

**采用方案**：先入队先排队，在此基础上尽量公平

```typescript
class DownloadThreadPool {
  private activeThreads: number = 0
  private queue: ChunkTask[] = []

  // 实时读取用户配置
  private get maxThreads(): number {
    return useConfigStore.getState().maxDownloadThreads
  }

  async submitChunk(task: ChunkTask): Promise<void> {
    this.queue.push(task)
    this.processQueue()
  }

  private processQueue(): void {
    while (this.activeThreads < this.maxThreads && this.queue.length > 0) {
      const task = this.queue.shift()!
      this.executeChunk(task)
    }
  }

  private async executeChunk(task: ChunkTask): Promise<void> {
    this.activeThreads++

    logger.debug(`[ThreadPool] Starting chunk`, {
      taskId: task.taskId,
      chunkIndex: task.chunk.index,
      activeThreads: this.activeThreads,
      maxThreads: this.maxThreads
    })

    try {
      await downloadChunk(task)
    } finally {
      this.activeThreads--
      this.processQueue()  // 处理下一个
    }
  }

  // 取消任务的所有分块
  cancelTaskChunks(taskId: string): void {
    this.queue = this.queue.filter(t => t.taskId !== taskId)
    logger.info(`[ThreadPool] Cancelled chunks for task ${taskId}`)
  }
}
```

### 4.2 线程分配示例

```
配置：maxDownloadThreads = 4

场景1：单任务 8 分块
  队列: [C1][C2][C3][C4][C5][C6][C7][C8]
  执行: [C1][C2][C3][C4]  ← 4个并行
  完成一个后自动拉入下一个

场景2：两任务各 4 分块
  队列: [T1-C1][T1-C2][T1-C3][T1-C4][T2-C1][T2-C2]...
  执行: [T1-C1][T1-C2][T1-C3][T1-C4]  ← T1 先入队，先执行
  T1 完成一块后，T2 开始执行
  最终: T1 和 T2 各获得约 2 个线程（公平）
```

### 4.3 资源限制建议

| 配置项 | 默认值 | 范围 | 说明 |
|--------|--------|------|------|
| maxDownloadThreads | 4 | 1-8 | 全局下载线程池大小 |
| maxUploadThreads | 4 | 1-8 | 全局上传线程池大小 |

**注意**：线程数变更会立即生效，无需重启任务

---

## 5. 日志系统设计

### 5.1 多线程调试需求

由于多线程执行不直观，需要详细的日志支持

```typescript
// 日志模块
const transferLogger = {
  // 任务级别
  taskCreated: (taskId: string, info: TaskInfo) => {
    logger.info(`[Transfer] Task created`, { taskId, ...info })
  },

  taskPaused: (taskId: string, chunks: ChunkProgress[]) => {
    logger.info(`[Transfer] Task paused`, { taskId, chunks })
  },

  taskResumed: (taskId: string, pendingChunks: number) => {
    logger.info(`[Transfer] Task resumed`, { taskId, pendingChunks })
  },

  taskCompleted: (taskId: string, duration: number) => {
    logger.info(`[Transfer] Task completed`, { taskId, duration })
  },

  // 分块级别
  chunkStarted: (taskId: string, chunkIndex: number, range: string) => {
    logger.debug(`[Transfer] Chunk started`, { taskId, chunkIndex, range })
  },

  chunkProgress: (taskId: string, chunkIndex: number, loaded: number, total: number) => {
    // 节流，避免日志过多
    logger.debug(`[Transfer] Chunk progress`, { taskId, chunkIndex, loaded, total })
  },

  chunkCompleted: (taskId: string, chunkIndex: number) => {
    logger.info(`[Transfer] Chunk completed`, { taskId, chunkIndex })
  },

  chunkError: (taskId: string, chunkIndex: number, error: Error) => {
    logger.error(`[Transfer] Chunk error`, { taskId, chunkIndex, error: error.message })
  },

  // 线程池级别
  poolStatus: (active: number, max: number, queued: number) => {
    logger.debug(`[ThreadPool] Status`, { active, max, queued })
  }
}
```

### 5.2 关键日志点

| 事件 | 级别 | 内容 |
|------|------|------|
| 任务创建 | INFO | taskId, 文件名, 大小, 分块数 |
| 分块开始 | DEBUG | taskId, chunkIndex, Range头 |
| 分块进度 | DEBUG | 每10%记录一次 |
| 分块完成 | INFO | taskId, chunkIndex, 耗时 |
| 分块失败 | ERROR | taskId, chunkIndex, 错误信息 |
| 任务暂停 | INFO | taskId, 各分块进度 |
| 任务恢复 | INFO | taskId, 待下载分块数 |
| 任务完成 | INFO | taskId, 总耗时, 平均速度 |
| 线程池状态 | DEBUG | 活跃/最大/排队数 |

---

## 6. 完整架构设计

### 6.1 状态流转

```
                    ┌──────────┐
                    │  创建任务 │
                    └────┬─────┘
                         ▼
               ┌─────────────────┐
               │ pending (等待中) │◄─────┐
               └────────┬────────┘      │
                        ▼               │
               ┌─────────────────┐      │
          ┌───►│ running (下载中)│      │
          │    └────────┬────────┘      │
          │             │               │
    恢复  │    ┌────────┴────────┐  暂停
          │    ▼                 ▼      │
          │ ┌────────┐     ┌──────────┐ │
          └─│ paused │     │ completed│ │
            └────────┘     └──────────┘ │
                 │                      │
                 └──────────────────────┘
```

### 6.2 模块划分

```
src/
├── lib/
│   ├── threadPool.ts          # 全局线程池
│   ├── chunkManager.ts        # 分块管理器
│   └── transferLogger.ts      # 传输日志（新增）
│
├── services/
│   └── chunkedDownload.ts     # 分块下载服务
│
├── stores/
│   ├── transferStore.ts       # 传输状态（现有）
│   └── pendingTransferStore.ts # 进行中任务持久化（新增）
│
└── types/
    └── chunk.ts               # 分块相关类型
```

### 6.3 核心流程

```typescript
// 1. 创建下载任务
async function createDownloadTask(file: FileItem): Promise<string> {
  const taskId = generateId()
  const chunks = calculateChunks(file.size)

  transferLogger.taskCreated(taskId, {
    fileName: file.name,
    fileSize: file.size,
    chunkCount: chunks.length
  })

  // 保存到 pending 存储
  await pendingStore.addTask({
    id: taskId,
    chunks,
    // ...
  })

  // 开始下载各分块
  for (const chunk of chunks) {
    threadPool.submitChunk({
      taskId,
      chunk,
      onProgress: (loaded) => updateProgress(taskId, chunk.index, loaded),
      onComplete: () => markChunkComplete(taskId, chunk.index)
    })
  }

  return taskId
}

// 2. 暂停任务
async function pauseTask(taskId: string): Promise<void> {
  // 取消所有进行中的分块
  threadPool.cancelTaskChunks(taskId)

  // 保存当前状态（每个分块的进度）
  await pendingStore.updateTask(taskId, task => ({
    ...task,
    status: 'paused',
    chunks: task.chunks.map(c => ({
      ...c,
      // loadedBytes 已实时更新
    }))
  }))

  transferLogger.taskPaused(taskId, pendingStore.getTask(taskId).chunks)
}

// 3. 恢复任务
async function resumeTask(taskId: string): Promise<void> {
  const task = pendingStore.getTask(taskId)

  // 只下载未完成的分块（使用当前 loadedBytes）
  const pendingChunks = task.chunks.filter(c => !c.completed)

  transferLogger.taskResumed(taskId, pendingChunks.length)

  for (const chunk of pendingChunks) {
    threadPool.submitChunk({
      taskId,
      chunk,
      rangeStart: chunk.start + chunk.loadedBytes,  // 从断点继续
      rangeEnd: chunk.end,
      // ...
    })
  }
}
```

---

## 7. 风险评估与缓解措施

### 7.1 技术风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 分块下载失败 | 中 | 单块重试机制，最多3次 |
| 合并时内存溢出 | 中 | 流式合并，Tauri 用文件系统 |
| 暂停后恢复丢失进度 | 低 | 每块完成立即保存 + 节流更新 |
| 线程池死锁 | 低 | 超时机制 + 强制释放 |
| 预签名URL过期 | 中 | 恢复时重新获取 |

### 7.2 用户体验风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 暂停后无法恢复 | 低 | 清晰的状态提示 + 日志 |
| 下载速度反而变慢 | 中 | 智能分块策略 + 可调整线程数 |
| 临时文件占用空间 | 中 | 完成后自动清理 + 手动清理入口 |
| 进度条不准确 | 低 | 基于字节数计算，非块序号 |

### 7.3 配置变更风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 暂停后改线程数 | 无 | 线程池实时读取配置 |
| 暂停后改分块策略 | 低 | 不支持，保持原分块 |

---

## 8. 实施计划

### Phase 1：基础分块下载（2天）
- [ ] 分块计算逻辑
- [ ] 单任务多线程下载
- [ ] 分块合并
- [ ] 基础日志

### Phase 2：暂停/恢复（1.5天）
- [ ] pending 持久化存储
- [ ] 暂停时保存进度
- [ ] 恢复时续传
- [ ] 预签名URL刷新

### Phase 3：全局线程池（1天）
- [ ] 线程池实现
- [ ] 多任务资源分配
- [ ] 配置热更新支持

### Phase 4：优化与测试（1天）
- [ ] 错误重试机制
- [ ] 进度条优化
- [ ] 边界情况测试
- [ ] 性能优化

**预计总工期：5-6天**

---

## 9. 配置项设计

```typescript
interface TransferConfig {
  // 线程设置（支持热更新）
  maxDownloadThreads: number    // 1-8, 默认4
  maxUploadThreads: number      // 1-8, 默认4
}
```

**注意**：移除了 chunkSize 和 minFileSizeForChunking 配置，改为固定策略，简化用户选择。

---

## 10. 总结

### 核心决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 分块策略 | **静态分块** | 简单可靠，易持久化 |
| 分块数 | **基于文件大小** | 1-8块，每块约5MB起 |
| 线程数 | **用户配置，实时生效** | 支持热更新 |
| 动态再切块 | **不支持** | 复杂度高，收益低 |
| 存储位置 | **独立 pending 存储** | 避免与 history 冲突 |
| 线程管理 | **全局线程池** | 公平分配，避免资源竞争 |
| 进度计算 | **基于总字节数** | 乱序完成也能准确显示 |
| 日志系统 | **详细日志** | 多线程调试必需 |

### 关键问题解答

| 问题 | 答案 |
|------|------|
| 进度条如何真实反映？ | 基于已下载总字节数计算，与分块完成顺序无关 |
| 线程数设置过少/过多？ | 分块数与线程数独立，线程池自动排队 |
| 暂停后改线程设置？ | 立即生效，不影响分块，只影响并发数 |
| 每个分块进度如何保存？ | 保存 loadedBytes，恢复时从该位置继续 |
| 多任务抢占资源？ | 全局线程池统一调度，先入先出 + 公平分配 |

### 预期收益

- **断点续传**：大文件下载更可靠
- **多线程加速**：大文件下载速度提升 2-4 倍
- **资源可控**：多任务不会抢占所有带宽
- **调试友好**：详细日志便于排查问题
