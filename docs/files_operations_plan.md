# 文件操作功能设计文档

> 复制、移动、重命名功能的设计方案

## 一、功能概述

| 操作 | 说明 | S3 API |
|------|------|--------|
| **复制** | 复制文件/文件夹到目标位置 | `CopyObject` |
| **移动** | 移动文件/文件夹（复制后删除源） | `CopyObject` + `DeleteObject` |
| **重命名** | 同一目录下更改名称（移动的特例） | `CopyObject` + `DeleteObject` |

### S3/R2 特性说明

- **无原生 rename API**：必须通过 Copy + Delete 实现
- **文件夹是虚拟概念**：以 `/` 结尾的前缀，复制文件夹需要遍历所有子对象
- **CopyObject 支持跨桶复制**：但本项目仅支持同桶操作
- **CopyObject 最大 5GB**：超过需要分块复制（暂不实现）

---

## 二、安全策略设计

### 2.1 循环引用检测

**问题**：将文件夹移动到自身或子目录会导致无限循环或数据丢失。

```
❌ folderA/ → folderA/sub/          # 直接子目录
❌ folderA/ → folderA/sub/deep/     # 深层嵌套
❌ folderA/file.txt → folderA/      # 文件夹包含自身
```

**检测算法**：

```typescript
/**
 * 检测是否为自身或子目录
 * @param source 源路径
 * @param target 目标路径
 */
function isSelfOrDescendant(source: string, target: string): boolean {
  // 统一格式：确保文件夹以 / 结尾
  const normalizeFolder = (path: string): string => {
    if (path.endsWith('/')) return path
    // 如果是文件（无扩展名判断），直接比较
    return path + '/'
  }

  const sourceFolder = source.includes('.')
    ? source.substring(0, source.lastIndexOf('/') + 1)
    : normalizeFolder(source)

  const targetFolder = target.includes('.')
    ? target.substring(0, target.lastIndexOf('/') + 1)
    : normalizeFolder(target)

  // 目标是源本身或源的子目录
  return targetFolder === sourceFolder || targetFolder.startsWith(sourceFolder)
}
```

### 2.2 重名冲突检测

**优化策略**：不使用逐个 `HeadObject` 请求，而是**一次性获取目标目录文件列表**，在本地进行批量检测。

```typescript
/**
 * 批量冲突检测（优化版）
 * @param bucket 桶名
 * @param items 待操作项列表
 * @returns 冲突检测结果
 */
async function detectConflicts(
  bucket: string,
  items: Array<{ source: string; target: string }>
): Promise<ConflictResult> {
  // 1. 收集所有需要检查的目标目录
  const targetDirs = new Set<string>()
  for (const item of items) {
    const dir = item.target.substring(0, item.target.lastIndexOf('/') + 1)
    targetDirs.add(dir)
  }

  // 2. 批量获取各目录的文件列表（并行请求）
  const dirContents = new Map<string, Set<string>>()
  await Promise.all(
    Array.from(targetDirs).map(async (dir) => {
      const objects = await listObjects(bucket, dir)
      dirContents.set(dir, new Set(objects.map(o => o.key)))
    })
  )

  // 3. 本地检测冲突
  const conflicts: ConflictInfo[] = []
  for (const item of items) {
    const dir = item.target.substring(0, item.target.lastIndexOf('/') + 1)
    const existingKeys = dirContents.get(dir)

    if (existingKeys?.has(item.target)) {
      conflicts.push({
        source: item.source,
        target: item.target,
        type: item.target.endsWith('/') ? 'folder' : 'file'
      })
    }
  }

  return { conflicts, scannedDirs: targetDirs.size }
}
```

**性能对比**：

| 方案 | 请求数 | 耗时（估算 100 项） |
|------|--------|---------------------|
| 逐个 HeadObject | 100 次 | ~10-15s |
| 批量 ListObjects | ~5-10 次（按目录） | ~1-2s |

---

## 三、冲突处理策略

### 3.1 用户选项设计（参考 Windows 10/11）

```
┌─────────────────────────────────────────────────────────────┐
│  发现冲突                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  目标位置已存在同名项目：                                     │
│  📄 document.pdf                                            │
│                                                             │
│  源：1.2 MB，2024-01-15                                     │
│  目标：980 KB，2024-01-10                                    │
│                                                             │
│  ○ 替换目标文件                                              │
│  ○ 跳过此项                                                  │
│  ○ 保留两者（自动重命名）                                     │
│                                                             │
│  ☑ 对所有冲突执行此操作                                       │
│                                                             │
│      [取消]              [继续]                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 自动重命名逻辑

```typescript
/**
 * 生成不冲突的新文件名
 * @param existingKeys 已存在的 key 集合
 * @param targetKey 目标 key
 */
function generateUniqueName(existingKeys: Set<string>, targetKey: string): string {
  // 如果不冲突，直接返回
  if (!existingKeys.has(targetKey)) return targetKey

  const lastSlash = targetKey.lastIndexOf('/')
  const dir = targetKey.substring(0, lastSlash + 1)
  const fullName = targetKey.substring(lastSlash + 1)

  // 分离文件名和扩展名
  const lastDot = fullName.lastIndexOf('.')
  const baseName = lastDot > 0 ? fullName.substring(0, lastDot) : fullName
  const extension = lastDot > 0 ? fullName.substring(lastDot) : ''

  // 找到最小的可用编号
  let counter = 1
  let newName: string
  do {
    newName = `${dir}${baseName} (${counter})${extension}`
    counter++
  } while (existingKeys.has(newName))

  // 将新名称加入集合，防止后续冲突
  existingKeys.add(newName)

  return newName
}
```

**示例**：

```
目标: folder/file.txt (已存在)
→ folder/file (1).txt

目标: folder/file.txt (file (1).txt 也存在)
→ folder/file (2).txt

目标: folder/docs/ (已存在)
→ folder/docs (1)/
```

### 3.3 冲突策略枚举

```typescript
type ConflictStrategy =
  | 'skip'        // 跳过冲突项
  | 'overwrite'   // 覆盖目标
  | 'rename'      // 自动重命名（保留两者）
  | 'ask'         // 逐个询问
```

---

## 四、批量操作流程

### 4.1 完整流程图

```
┌────────────────────────────────────────────────────────────────┐
│                      批量操作流程                               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  用户选择文件 → 点击"移动到..."或"复制到..."                      │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────────────────────────────┐                  │
│  │  第一阶段：逻辑预检（无 API 调用）          │                  │
│  │  • 过滤"移动到自身/子目录"的项             │                  │
│  │  • 标记为 skipped                         │                  │
│  └─────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────────────────────────────┐                  │
│  │  第二阶段：冲突检测（批量 ListObjects）     │                  │
│  │  • 收集目标目录                           │                  │
│  │  • 并行获取文件列表                       │                  │
│  │  • 本地检测冲突                          │                  │
│  └─────────────────────────────────────────┘                  │
│       │                                                        │
│       ├──── 无冲突 ──────────────────────────────┐             │
│       │                                          ▼             │
│       │                              ┌────────────────────┐   │
│       │                              │  直接执行操作       │   │
│       │                              └────────────────────┘   │
│       │                                                        │
│       └──── 有冲突 ──────────────────────────────┐             │
│                                                  ▼             │
│                              ┌────────────────────────────┐   │
│                              │  显示冲突对话框             │   │
│                              │  让用户选择处理策略         │   │
│                              └────────────────────────────┘   │
│                                           │                    │
│                                           ▼                    │
│                              ┌────────────────────────────┐   │
│                              │  根据策略处理冲突           │   │
│                              │  • skip: 跳过              │   │
│                              │  • overwrite: 覆盖         │   │
│                              │  • rename: 自动重命名      │   │
│                              └────────────────────────────┘   │
│                                           │                    │
│                                           ▼                    │
│  ┌─────────────────────────────────────────┐                  │
│  │  第三阶段：执行操作                        │                  │
│  │  • 显示进度气泡                          │                  │
│  │  • 逐个执行 Copy/Delete                  │                  │
│  │  • 实时更新进度                          │                  │
│  └─────────────────────────────────────────┘                  │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────────────────────────────┐                  │
│  │  第四阶段：结果汇报                        │                  │
│  │  • 成功数 / 跳过数 / 失败数               │                  │
│  │  • 失败项详情（可展开）                   │                  │
│  └─────────────────────────────────────────┘                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 操作结果类型

```typescript
interface OperationResult {
  // 成功的项
  succeeded: Array<{
    source: string
    target: string
    operation: 'copy' | 'move'
  }>

  // 跳过的项（自身移动、冲突跳过）
  skipped: Array<{
    source: string
    reason: 'self_move' | 'conflict_skip' | 'user_skip'
  }>

  // 失败的项（API 错误）
  failed: Array<{
    source: string
    error: string
  }>

  // 重命名的项（自动重命名）
  renamed: Array<{
    source: string
    originalTarget: string
    actualTarget: string
  }>
}
```

---

## 五、UI 设计

### 5.1 进度气泡组件

**设计原则**：
- 参考 Windows 10/11 文件操作设计
- 右下角固定位置，不遮挡主要内容
- 支持最小化/展开
- 单次批量操作共用一个气泡

**最小化状态**：

```
┌─────────────────────────────────┐
│  ○ 67%  正在移动...             │  ← 环形进度条 + 百分比
└─────────────────────────────────┘
     ↑ 宽度约 200px，高度约 40px
```

**展开状态**：

```
┌─────────────────────────────────────────────┐
│  正在移动文件...                    [─] [×] │
├─────────────────────────────────────────────┤
│  ████████████░░░░░░░░░░ 67%  (10/15)        │
├─────────────────────────────────────────────┤
│  ✓ folderA/document.pdf → folderB/          │
│  ✓ folderA/image.png → folderB/             │
│  → 正在复制: folderA/video.mp4 → folde...   │  ← 当前操作
│  ⏳ 等待中: folderA/data.json                │
│  ...                                        │
└─────────────────────────────────────────────┘
      ↑ 宽度约 320px，最大高度 300px，超出滚动
```

### 5.2 长路径处理

```typescript
/**
 * 截断长路径，保留文件名
 */
function truncatePath(path: string, maxLength: number = 40): {
  display: string
  full: string
} {
  if (path.length <= maxLength) {
    return { display: path, full: path }
  }

  // 提取文件名
  const lastSlash = path.lastIndexOf('/')
  const fileName = lastSlash > 0 ? path.substring(lastSlash + 1) : path
  const dirPath = lastSlash > 0 ? path.substring(0, lastSlash + 1) : ''

  if (fileName.length >= maxLength - 5) {
    // 文件名本身就太长
    return {
      display: `...${fileName.substring(0, maxLength - 5)}...`,
      full: path
    }
  }

  // 截断目录路径，保留文件名
  const availableLength = maxLength - fileName.length - 4 // 4 = ".../"
  const truncatedDir = dirPath.length > availableLength
    ? `...${dirPath.substring(dirPath.length - availableLength)}`
    : dirPath

  return {
    display: `${truncatedDir}${fileName}`,
    full: path
  }
}
```

**显示效果**：

```
→ 正在复制: ...older/subfolder/file.pdf
   ↑ hover 显示完整路径: "very/long/path/to/folder/subfolder/file.pdf"
```

### 5.3 气泡状态流转

```typescript
type BubbleState =
  | 'preparing'    // 准备中（预检）
  | 'confirming'   // 等待用户确认冲突
  | 'running'      // 执行中
  | 'completed'    // 已完成
  | 'error'        // 出错

interface ProgressBubbleProps {
  state: BubbleState
  operation: 'copy' | 'move'
  progress: {
    current: number
    total: number
    percentage: number
    currentItem?: string
  }
  result?: OperationResult
  onMinimize: () => void
  onExpand: () => void
  onClose: () => void
}
```

### 5.4 组件位置

```
┌──────────────────────────────────────────────────────────┐
│  Header                                                   │
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  Sidebar   │              Main Content                   │
│            │                                             │
│            │                                             │
│            │                                             │
└────────────┴─────────────────────────────────────────────┘
                                                        ┌───────┐
                                                        │ Bubble│ ← 右下角
                                                        └───────┘   fixed positioning
                                                                    bottom: 20px
                                                                    right: 20px
```

---

## 六、API 设计

### 6.1 后端新增接口

```typescript
// 复制对象（支持跨目录、自动展开文件夹）
POST /api/buckets/:bucketName/objects/copy
Body: {
  sourceKey: string       // 源路径
  targetKey: string       // 目标路径
  overwrite?: boolean     // 是否覆盖（默认 false）
}

// 批量复制
POST /api/buckets/:bucketName/objects/batch-copy
Body: {
  items: Array<{ source: string; target: string }>
  overwrite?: boolean
}

// 移动对象
POST /api/buckets/:bucketName/objects/move
Body: {
  sourceKey: string
  targetKey: string
  overwrite?: boolean
}

// 批量移动
POST /api/buckets/:bucketName/objects/batch-move
Body: {
  items: Array<{ source: string; target: string }>
  overwrite?: boolean
}
```

### 6.2 后端实现要点

```javascript
// 复制单个对象
async function copyObject(bucket, sourceKey, targetKey) {
  // 如果是文件夹，递归复制
  if (sourceKey.endsWith('/')) {
    return await copyFolder(bucket, sourceKey, targetKey)
  }

  // 单文件复制
  const command = new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: targetKey,
  })
  await r2Client.send(command)
}

// 复制文件夹
async function copyFolder(bucket, sourcePrefix, targetPrefix) {
  // 1. 列出所有子对象
  const allObjects = await listAllObjects(bucket, sourcePrefix)

  // 2. 逐个复制
  for (const obj of allObjects) {
    const relativePath = obj.Key.substring(sourcePrefix.length)
    const newKey = `${targetPrefix}${relativePath}`

    await r2Client.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${obj.Key}`,
      Key: newKey,
    }))
  }

  return { copied: allObjects.length }
}
```

### 6.3 前端服务层

```typescript
// src/services/fileService.ts
export const fileService = {
  // ... 现有方法

  async copyObject(
    bucketName: string,
    sourceKey: string,
    targetKey: string,
    overwrite: boolean = false
  ): Promise<{ success: boolean; key: string }> {
    const response = await api.fetch(`/api/buckets/${bucketName}/objects/copy`, {
      method: 'POST',
      body: JSON.stringify({ sourceKey, targetKey, overwrite })
    })
    return response
  },

  async moveObject(
    bucketName: string,
    sourceKey: string,
    targetKey: string,
    overwrite: boolean = false
  ): Promise<{ success: boolean; key: string }> {
    const response = await api.fetch(`/api/buckets/${bucketName}/objects/move`, {
      method: 'POST',
      body: JSON.stringify({ sourceKey, targetKey, overwrite })
    })
    return response
  },

  async batchCopy(
    bucketName: string,
    items: Array<{ source: string; target: string }>,
    options?: { overwrite?: boolean; onProgress?: ProgressCallback }
  ): Promise<OperationResult> {
    // 客户端逐个调用以支持进度回调
    // 或使用后端批量接口
  },

  async batchMove(
    bucketName: string,
    items: Array<{ source: string; target: string }>,
    options?: { overwrite?: boolean; onProgress?: ProgressCallback }
  ): Promise<OperationResult> {
    // 同上
  }
}
```

---

## 七、HeadObject 性能调研

### 7.1 技术分析

| 指标 | 说明 |
|------|------|
| **请求类型** | HEAD 请求（仅返回元数据，无 body） |
| **响应大小** | ~200-500 bytes（headers only） |
| **延迟** | 与 GET 请求类似，取决于网络 RTT |
| **R2 限制** | 无特殊限制，遵循通用 API 速率限制 |

### 7.2 性能测试估算

假设：
- 单次 HeadObject 延迟：~50-100ms（国内访问 R2）
- 批量检测 100 个文件冲突

| 方案 | 请求数 | 串行耗时 | 并行耗时（10 并发） |
|------|--------|----------|---------------------|
| 逐个 HeadObject | 100 | 5-10s | 0.5-1s |
| 批量 ListObjects | 5-10（按目录） | 0.25-1s | 0.1-0.2s |

### 7.3 结论

1. **小批量（<20 项）**：两种方案差异不大，可使用简单方案
2. **中大批量（20-500 项）**：**强烈推荐 ListObjects 批量方案**
3. **超大批量（>500 项）**：
   - 考虑跳过冲突检测，直接覆盖
   - 或提供"快速模式"选项

### 7.4 推荐策略

```typescript
// 根据批量大小自动选择策略
function selectConflictStrategy(itemCount: number): ConflictStrategy {
  if (itemCount <= 20) {
    return 'ask'  // 小批量：逐个询问
  } else if (itemCount <= 100) {
    return 'skip' // 中批量：默认跳过，用户可改
  } else {
    return 'overwrite' // 大批量：默认覆盖，显示警告
  }
}
```

---

## 八、实现优先级

### Phase 1：基础功能（MVP）✅ 已完成 (v0.9.7)

- [x] 后端 CopyObject API
- [x] 后端 MoveObject API（Copy + Delete）
- [x] 前端单文件复制/移动
- [x] 基础冲突检测（跳过）
- [x] 支持跨桶移动/复制
- [x] 重命名功能（移动的特例）
- [x] 可折叠文件夹浏览器侧边栏
- [x] 面包屑路径导航
- [x] 循环引用检测

### Phase 2：批量操作 ✅ 已完成 (v0.9.8)

- [x] 批量复制/移动（集成到传输中心）
- [x] 自身移动检测（移动到自身或子目录时跳过）
- [x] SSE 实时进度反馈
- [x] 传输中心批量操作标签页
- [x] 进度气泡组件（最小化状态）✅ v0.9.14
  - [x] 环形进度条 + 百分比显示
  - [x] 点击跳转到传输中心
  - [x] 操作完成自动隐藏
- [x] 批量冲突检测（ListObjects 方案）
  - [x] 文件夹子文件批量检测（v0.9.8）
  - [x] 顶层单文件批量检测（v0.9.12，性能优化）

### Phase 3：完善体验

- [ ] 冲突对话框（多选项 + "总是"复选框）
- [ ] 自动重命名（保留两者）
- [ ] 进度气泡展开状态
- [ ] 长路径截断 + hover 提示
- [ ] 操作结果详情（错误报告）
- [x] 优化速度（并行请求）✅ v0.9.13
  - [x] 多文件夹并行 - 使用 `runWithConcurrency()` 并发执行器
  - [x] 用户可配置并发数（1-8，默认 4）- 设置对话框 → 并发标签页
  - [x] 文件夹内部并行 - 使用 `Semaphore` 信号量控制总并发数

---

## 九、参考设计

- Windows 10/11 文件资源管理器
- macOS Finder
- Google Drive 文件操作
- Dropbox 文件同步冲突处理
