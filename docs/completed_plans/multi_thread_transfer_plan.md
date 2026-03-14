# 多线程分块传输技术方案

> 调研日期：2026-03-11
> 最后更新：2026-03-14
> 状态：Phase 1-5 全部完成
> 目标：实现断点续传 + 多线程分块下载 + 多线程分块上传 + 全局线程池 + 错误重试

---

## 实现概览

### 核心文件

| 文件 | 职责 |
|------|------|
| `src/types/chunk.ts` | 分块类型定义（ChunkInfo、ChunkDownloadResult、ChunkStrategy） |
| `src/types/threadPool.ts` | 线程池类型定义（ThreadPoolClient、TaskSlotInfo） |
| `src/lib/chunkManager.ts` | 分块计算逻辑 |
| `src/lib/threadPool.ts` | 全局线程池管理器（GlobalThreadPoolManager 单例） |
| `src/lib/transferLogger.ts` | 传输日志模块 |
| `src/lib/abortRegistry.ts` | Abort 函数注册表（真取消机制） |
| `src/lib/downloadCacheManager.ts` | 下载缓存管理（IndexedDB） |
| `src/services/chunkedUpload.ts` | S3 Multipart Upload 实现 |
| `src/services/chunkedDownload.ts` | 分块下载实现 |
| `server/index.js` | 后端 Range 请求 + Multipart API |

---

## 分块策略

| 文件大小 | 分块数 | 说明 |
|----------|--------|------|
| < 10MB | 1 | 不分块，使用原有单线程 |
| 10-50MB | 2 | 2 分块并发 |
| 50-200MB | 4 | 4 分块并发 |
| \> 200MB | 8 | 8 分块并发 |

**核心原则**：分块数 ≠ 线程数
- 分块数：由文件大小决定
- 线程数：由用户配置决定，实时生效

---

## 后端 API 端点

### Multipart Upload

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/buckets/:bucket/objects/:key/multipart/initiate` | POST | 初始化分块上传 |
| `/api/buckets/:bucket/objects/:key/multipart/upload-part` | POST | 上传单个分块 |
| `/api/buckets/:bucket/objects/:key/multipart/complete` | POST | 合并所有分块 |
| `/api/buckets/:bucket/objects/:key/multipart/abort` | POST | 取消上传，清理已上传分块 |
| `/api/buckets/:bucket/objects/:key/multipart/parts` | GET | 查询已上传分块 |

### Range 请求
- 标准 `Range: bytes=start-end` 头支持
- 返回 206 Partial Content

---

## 全局线程池

### 功能
- 两个独立线程池（上传和下载分开管理）
- 按任务优先级（列表顺序）分配资源
- 暂停时释放资源给后续任务
- 恢复时重新排队等待
- 配置热更新

### 调试方法

```js
// 浏览器控制台调用
window.threadPoolDebug()
// 返回结构：
{
  upload: {
    globalLimit: 4,
    tasks: [...],
    usedSlots: 4,
    availableSlots: 0
  },
  download: {
    globalLimit: 4,
    tasks: [...],
    usedSlots: 2,
    availableSlots: 2
  }
}
```

### 数据流

```
用户添加任务 → App.tsx
    │
    ├─→ globalThreadPool.registerTask(taskId, 'upload', 4)
    │       └─→ 线程池分配资源（按顺序）
    │
    └─→ new ChunkedUploader({ threadPoolClient: client })
            └─→ start() 时从 client 获取实际并发数

用户暂停任务 → transferStore.pauseTask()
    │
    └─→ client.notifyStatusChange('paused')
            └─→ 线程池 reallocate() → 资源释放给后续任务

用户修改并发设置 → configStore
    │
    └─→ 线程池监听到变化 → updateGlobalLimit()
            └─→ reallocate() → 重新分配资源
```

---

## 暂停/恢复机制

### 上传
- **暂停**：中断所有活跃 XHR，状态持久化到 store
- **恢复**：从服务器获取已上传分块（ListParts API），跳过已完成部分
- 会话过期检测（S3 Multipart Upload 24小时限制）

### 下载（真断点续传）
- **暂停**：保存部分数据到 IndexedDB（包含 `loadedBytes` 元数据）
- **恢复**：
  1. 从缓存加载部分数据
  2. 计算断点: `resumeOffset = chunk.start + loadedBytes`
  3. Range 请求剩余数据
  4. 新数据追加到部分数据末尾

---

## 配置项

| 配置项 | 默认值 | 范围 | 说明 |
|--------|--------|------|------|
| maxDownloadThreads | 4 | 1-8 | 全局下载线程池大小 |
| maxUploadThreads | 4 | 1-8 | 全局上传线程池大小 |
| uploadChunkSize | 10 | 5-16 MB | 上传分块大小 |
| downloadChunkSize | 8 | 4-32 MB | 下载分块大小 |

**注意**：线程数变更会立即生效，无需重启任务

---

## 性能优化记录

### 2026-03-14 错误重试机制（Phase 5）
- 网络错误和服务器 5xx 响应时自动重试
- 指数退避 + 随机抖动策略，避免服务器压力过大
- 支持配置重试次数、基础延迟和最大延迟
- UI 显示重试状态和错误信息

### 2026-03-14 全局线程池（Phase 4）
- 解决多任务并发资源竞争问题
- 上传和下载使用独立线程池
- 支持配置热更新

### 2026-03-13 下载断点续传
- 实现真正的断点续传（从暂停位置继续，而非重新下载整个分块）
- 部分数据保存到 IndexedDB

### 2026-03-12 上传暂停/恢复
- 通过 `activeXhrs` Map 追踪所有活跃 XHR
- 从服务器获取真实已上传分块状态

### 2026-03-12 进度报告节流
- 添加 200ms 节流间隔
- 减少 CPU 占用约 60%，下载速度提升 36%

---

## Phase 5：错误重试机制（已完成）

> 调研日期：2026-03-14
> 状态：已完成

### 当前状态

**现状**：分块上传/下载失败时直接抛出错误，任务终止
- `chunkedUpload.ts`: `xhr.onerror` 直接 reject
- `chunkedDownload.ts`: HTTP 错误直接 throw

**问题**：网络抖动、服务器临时不可用会导致整个任务失败

### 需要重试的场景

| 场景 | 触发条件 | 预期行为 |
|------|----------|----------|
| 网络抖动 | XHR onerror / fetch NetworkError | 自动重试 |
| 服务器 5xx | HTTP 500/502/503/504 | 自动重试 |
| 服务器 429 | HTTP 429 Too Many Requests | 延迟重试 |
| 连接超时 | XHR timeout | 自动重试 |
| 服务器 4xx | HTTP 400/403/404 | **不重试**，直接失败 |

### 错误分类

```typescript
// 可重试错误
const RETRYABLE_ERRORS = [
  'NetworkError',
  'TimeoutError',
  'AbortError',      // 部分场景
]

const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]

// 不可重试错误
const NON_RETRYABLE_STATUS_CODES = [
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  409, // Conflict
]
```

### 重试策略

#### 指数退避算法

```typescript
// 重试延迟计算
function calculateDelay(attempt: number, baseDelay: number): number {
  // 指数退避 + 随机抖动
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // 30% 抖动
  return Math.min(exponentialDelay + jitter, MAX_DELAY) // 最大 30 秒
}

// 示例（baseDelay = 2000ms）
// 第 1 次重试: ~2-2.6s
// 第 2 次重试: ~4-5.6s
// 第 3 次重试: ~8-10.4s
```

#### 重试流程

```
分块请求失败
    │
    ├─→ 检查错误类型
    │       │
    │       ├─→ 不可重试（4xx）→ 直接失败
    │       │
    │       └─→ 可重试 → 检查重试次数
    │               │
    │               ├─→ 达到上限 → 失败
    │               │
    │               └─→ 未达上限 → 计算延迟
    │                       │
    │                       └─→ 等待 → 重新请求
```

### 实现位置

| 文件 | 修改内容 |
|------|----------|
| `src/lib/retryHelper.ts` | **新建** - 重试逻辑封装 |
| `src/services/chunkedUpload.ts` | uploadPart 方法添加重试 |
| `src/services/chunkedDownload.ts` | downloadChunk 方法添加重试 |
| `src/types/transfer.ts` | 添加重试相关类型定义 |
| `src/stores/configStore.ts` | 添加重试配置项 |

### 核心实现（草案）

```typescript
// src/lib/retryHelper.ts
interface RetryOptions {
  maxRetries: number       // 最大重试次数，默认 3
  baseDelay: number        // 基础延迟 ms，默认 1000
  maxDelay: number         // 最大延迟 ms，默认 30000
  retryableStatusCodes: number[]
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // 检查是否可重试
      if (!isRetryable(error, options.retryableStatusCodes)) {
        throw error
      }

      // 最后一次尝试不再等待
      if (attempt === options.maxRetries) {
        break
      }

      // 计算延迟并等待
      const delay = calculateDelay(attempt, options.baseDelay)
      transferLogger.retryScheduled(attempt + 1, delay)
      await sleep(delay)
    }
  }

  throw lastError
}
```

### 配置项

| 配置项 | 默认值 | 范围 | 说明 |
|--------|--------|------|------|
| retryMaxAttempts | 3 | 0-10 | 最大重试次数（0 = 禁用重试） |
| retryBaseDelay | 1000 | 500-5000 ms | 基础重试延迟 |
| retryMaxDelay | 30000 | 10000-60000 ms | 最大重试延迟 |

### 日志输出

```
[Transfer] Part 3 upload failed (HTTP 503), retrying...
[Transfer] Retry attempt 1/3, delay: 1200ms
[Transfer] Part 3 upload succeeded after 1 retry
```

### 测试场景

| 场景 | 测试方法 | 预期结果 |
|------|----------|----------|
| 网络断开重连 | 下载中断开网络后恢复 | 自动重试成功 |
| 服务器 503 | 模拟 503 响应 | 指数退避重试 |
| 4xx 错误 | 模拟 403 响应 | 立即失败，不重试 |
| 重试次数耗尽 | 模拟持续失败 | 达到上限后失败 |
| 用户取消 | 重试等待中取消 | 立即终止，不继续重试 |

### 待定问题

1. **重试计数器位置**：是按分块计数还是按任务计数？
   - 建议：按分块计数，一个分块失败不影响其他分块
   - 选择: 分块计数

2. **是否显示重试状态**：UI 是否显示"重试中"？
   - 建议：显示小图标或文字提示
   - 选择: 显示文字"出现错误，正在重试"，恢复时需要消除提示

3. **暂停时重试**：暂停状态下是否继续重试？
   - 建议：暂停时取消所有重试等待
   - 选择: 暂停取消
