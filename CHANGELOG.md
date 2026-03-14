# Changelog

All notable changes to this project will be documented in this file.

## [0.9.15] - 2026-03-14

### Added
- **进度气泡 Hover 展开详情** - 悬停显示批量操作子项级别进度
  - `src/types/transfer.ts` - 新增 `BatchOperationItem` 类型定义子项状态（pending/running/completed/skipped/error）
  - `src/stores/transferStore.ts` - 新增 `updateBatchItemStatus()` 方法更新单个子项状态
  - `src/lib/utils.ts` - 新增 `truncatePath()` 函数智能截断长路径
  - 子项状态图标：⏳等待中 / 🔄处理中 / ✅完成 / ⚠️跳过 / ❌错误
  - 自动滚动到正在处理的项（用户滚动时暂停 3 秒）
  - 气泡宽度动画：200px → 320px

### Improved
- **批量操作进度追踪** - 实时更新每个子项的处理状态
  - `src/App.tsx` - 批量操作初始化子项列表，完成后更新每个子项最终状态
  - SSE 进度数据新增 `currentSourceKey` 字段标识当前处理的文件
  - 跳过/错误状态显示具体原因

---

## [0.9.14] - 2026-03-14

### Added
- **进度气泡组件** - 批量复制/移动操作时显示实时进度反馈
  - `src/components/transfer/CircularProgress.tsx` - 环形进度条组件（SVG + Framer Motion 动画）
  - `src/components/transfer/ProgressBubble.tsx` - 进度气泡主组件
  - 右下角固定位置，不遮挡主要内容
  - 显示环形进度条 + 百分比 + 操作类型（复制/移动）
  - 点击气泡跳转到传输中心页面
  - 操作完成后自动隐藏

---

## [0.9.13] - 2026-03-14

### Added
- **批量操作并发数配置** - 用户可自定义批量复制/移动的并发数
  - `src/stores/configStore.ts` - 新增 `maxBatchOperationThreads` 配置项（默认 4，范围 1-8）
  - `src/components/config/SettingsDialog.tsx` - 设置对话框并发标签页添加批量操作并发数输入控件
  - `src/services/api.ts` - `batchCopyWithProgress()` 和 `batchMoveWithProgress()` 新增 `maxConcurrency` 参数
  - `src/App.tsx` - 批量操作调用时使用用户配置的并发数

### Improved
- **单文件移动/复制集成传输中心** - 与批量操作保持一致的交互体验
  - `src/App.tsx` - `handleMove()` 和 `handleCopy()` 创建传输任务记录
  - 改为异步执行模式，对话框可立即关闭
  - 错误信息记录到传输历史而非弹窗提示
  - 用户可在传输中心查看操作进度和历史
- **批量复制/移动并行优化** - 从串行处理改为并行处理
  - `server/index.js` - 新增 `runWithConcurrency()` 通用并发执行器
  - 批量复制 API 使用并发执行器，支持 `maxConcurrency` 参数
  - 批量移动 API 使用并发执行器，支持 `maxConcurrency` 参数
  - 使用共享 stats 对象实现原子统计更新
  - 多个文件夹可同时并行处理，显著提升批量操作速度
- **文件夹内部并行处理** - 文件夹内子文件也支持并行复制/移动
  - `server/index.js` - 新增 `Semaphore` 信号量类控制总并发数
  - 使用共享信号量确保外层并发 × 内层并发不超过配置上限
  - 单个大文件夹（如 100 个文件）复制速度提升约 3-4 倍
- **传输中心标签页滑动动效** - framer-motion 弹性滑动指示框
  - `src/components/transfer/TransferTabs.tsx` - 添加 layoutId 滑动指示框
  - 使用 Spring 弹性动画（stiffness: 400, damping: 30）
- **设置对话框子导航滑动动效** - 与主导航栏风格统一
  - `src/components/config/SettingsDialog.tsx` - 并发标签页二级导航添加滑动指示框
- **批量操作历史清空功能** - 支持清空批量复制/移动的完成记录
  - `src/components/transfer/TransferPage.tsx` - 批量完成标签页显示清空按钮

### Fixed
- **framer-motion ref warning 修复** - HistoryItem 组件使用 forwardRef
  - `src/components/transfer/HistoryItem.tsx` - 修复 "Function components cannot be given refs" 警告

### Technical
- **并发执行器设计**：
  - Worker 池模式：启动 N 个 worker 协同消费任务队列
  - 进度回调：每完成一项立即报告进度
  - 错误隔离：单个任务失败不影响其他任务
- **信号量设计（Semaphore）**：
  - 共享信号量：顶层 items 和文件夹内部共享同一个信号量
  - 总并发数控制：避免资源耗尽，保证系统稳定性
  - 无需新增配置：复用 `maxBatchOperationThreads` 配置
- **性能提升**：
  - 选中 10 个文件夹复制时，并发数 4 可提升约 3-4 倍速度
  - 单个包含 100 文件的文件夹，复制速度提升约 3-4 倍

---

## [0.9.12] - 2026-03-14

### Improved
- **批量冲突检测性能优化** - 使用 ListObjects 替代逐个 HeadObject
  - `server/index.js` - 新增 `detectConflictsWithListObjects()` 函数
  - 批量操作前预先检测所有顶层单文件冲突（1 次 ListObjects vs N 次 HEAD）
  - 文件夹复制/移动使用批量冲突检测，跳过冲突文件继续处理
  - 冲突文件计入跳过统计，不再中断整个操作
- **SSE 日志功能** - 后端日志输出到浏览器控制台
  - `server/index.js` - 新增 `sendSSELog()` 函数
  - `src/services/api.ts` - 前端处理 `log` 类型 SSE 事件
  - 便于调试批量操作的冲突检测过程

### Technical
- **批量冲突检测算法**：
  1. 收集所有待检测项的目标目录前缀
  2. 对每个前缀发起一次 ListObjects 请求（并行）
  3. 本地检测哪些目标文件已存在
- **性能对比**：选中 20 个文件复制时，从 20 次 HEAD 请求 → 1-2 次 ListObjects 请求

---

## [0.9.11] - 2026-03-14

### Fixed
- **下载断点续传边界检查** - 修复多次暂停恢复后 "offset is out of boundry" 错误
  - `src/services/chunkedDownload.ts` - 添加 `resumeOffset` 边界检查
  - 恢复时使用 `Math.min(loadedBytes, blob.size, expectedSize)` 确保数据一致性
  - 无效偏移量自动重置并重新下载该分块
- **重试机制浏览器兼容性** - 修复 `ReferenceError: require is not defined`
  - `src/lib/retryHelper.ts` - 将 `require()` 改为 ES 模块静态导入

---

## [0.9.10] - 2026-03-14

### Added
- **错误重试机制** - 网络错误和服务器临时不可用时自动重试
  - `src/types/retry.ts` - 重试类型定义（RetrySettings、RetryConfig、RetryContext）
  - `src/lib/retryHelper.ts` - 核心重试逻辑（指数退避 + 随机抖动）
    - `isRetryableError()` - 判断错误是否可重试（网络错误、5xx、429、408）
    - `calculateDelay()` - 计算重试延迟（指数退避 + 30% 抖动）
    - `withRetry()` - 带重试的异步操作包装器
  - `src/lib/transferLogger.ts` - 新增重试日志方法（retryScheduled、retrySucceeded、retryFailed）
  - `src/stores/configStore.ts` - 新增重试配置（retryMaxAttempts、retryBaseDelay、retryMaxDelay）
  - `src/components/config/SettingsDialog.tsx` - 设置对话框新增重试配置 UI
- **Tabs 组件** - shadcn/ui 标签页组件
  - `src/components/ui/tabs.tsx` - 基于 @radix-ui/react-tabs 封装

### Improved
- **设置对话框 UI 优化** - 改善用户体验和视觉稳定性
  - 固定对话框高度（70vh），避免切换标签时高度跳动
  - 固定 Header 和主导航栏，内容区域独立滚动
  - "传输"标签新增二级导航：并发设置、分块设置、下载路径、错误重试
  - 每个二级标签独立滚动，保存按钮固定在底部
- **ChunkedUploader** - 上传分块失败时自动重试
  - `uploadPart()` 拆分为 `uploadPart()` + `uploadPartOnce()`
  - 支持暂停/取消时中断重试等待
  - HTTP 错误包含状态码用于重试判断
- **ChunkedDownloader** - 下载分块失败时自动重试
  - `downloadChunk()` 拆分为 `downloadChunk()` + `downloadChunkOnce()`
  - 网络错误和服务器 5xx 自动重试
- **TaskItem** - 显示重试状态
  - 重试中显示"正在重试 (1/3)"
  - 进度条显示黄色
  - 显示重试错误信息

### Technical
- **重试策略**：指数退避 + 随机抖动，避免服务器压力过大
  - 基础延迟：1 秒
  - 最大延迟：30 秒
  - 默认重试次数：3 次
- **可重试错误**：
  - 网络错误（NetworkError、TimeoutError）
  - HTTP 状态码：408、429、500、502、503、504
- **不可重试错误**：
  - HTTP 状态码：400、401、403、404、409

---

## [0.9.9] - 2026-03-14

### Added
- **全局线程池** - 上传和下载任务的全局并发资源管理
  - `src/types/threadPool.ts` - 线程池类型定义（ThreadPoolClient、TaskSlotInfo 等）
  - `src/lib/threadPool.ts` - 核心线程池实现（GlobalThreadPoolManager 单例）
  - 上传和下载分别管理独立的线程池
  - 按任务列表顺序分配资源（从上到下优先）
  - 暂停的任务自动释放资源给后续任务
  - 配置热更新支持（修改并发设置立即生效）

### Improved
- **ChunkedUploader** - 添加 `threadPoolClient` 可选参数
  - `start()` 时从线程池获取实际分配的并发数
  - `pause()` 时通知线程池释放资源
  - `abort()` 时释放线程池资源
- **ChunkedDownloader** - 添加 `threadPoolClient` 可选参数
  - 同样的线程池集成逻辑
  - 优雅降级：不提供 client 时回退到原有静态并发控制

### Technical
- **资源分配算法**：
  1. 按任务优先级（列表顺序）排序
  2. 只给 `running` 或 `pending` 状态的任务分配资源
  3. 每个任务最多分配 `min(requested, availableSlots)`
  4. 资源耗尽时停止分配
- **调试方法**（开发环境）：
  ```js
  // 浏览器控制台调用
  window.threadPoolDebug()
  // 返回: { upload: {...}, download: {...} }
  // 包含: globalLimit, tasks, usedSlots, availableSlots
  ```

---

## [0.9.8] - 2026-03-14

### Added
- **批量复制/移动功能** - Phase 2 集成到传输中心
  - `server/index.js` - 新增 `/batch-copy` 和 `/batch-move` API 端点，支持 SSE 实时进度
  - `src/services/api.ts` - 新增 `batchCopyWithProgress()` 和 `batchMoveWithProgress()` 方法
  - `src/stores/transferStore.ts` - 新增 `addBatchOperationTask()` 和 `updateBatchProgress()` 方法
  - `src/types/transfer.ts` - 新增 `copy`/`move` 传输方向，批量操作相关类型
  - `src/components/file/ConflictDialog.tsx` - 冲突对话框组件（覆盖/跳过/取消）
  - `src/components/file/MoveCopyDialog.tsx` - 支持批量模式 (`batchMode`)
  - `src/components/transfer/TransferTabs.tsx` - 新增"批量操作"和"批量完成"标签页
  - `src/components/layout/Header.tsx` - 批量操作菜单添加"移动/复制选中项"

### Improved
- **传输中心扩展** - 支持批量操作任务显示
  - TaskItem 显示复制/移动图标和进度（X/Y 项格式）
  - TransferPage 支持批量操作标签页筛选
  - 批量操作历史记录（暂不支持清空）
- **SSE 实时进度** - 批量操作使用 Server-Sent Events 推送进度
  - 封装 `reportBatchProgress()` 辅助函数
  - XHR 流式读取 SSE 事件
  - 实时更新已完成项数和百分比

### Technical
- 批量操作通过 XHR + SSE 实现实时进度反馈
- 移动操作检测"移动到自身或子目录"并自动跳过
- 异步执行批量操作，不阻塞对话框关闭
- 完成后自动刷新文件列表

---

## [0.9.7] - 2026-03-13

### Added
- **文件复制/移动/重命名功能** - Phase 1 MVP 实现
  - `server/index.js` - 新增 `/copy` 和 `/move` API 端点，支持跨桶操作
  - `src/services/api.ts` - 新增 `copyObject()` 和 `moveObject()` 方法
  - `src/services/fileService.ts` - 新增 `copyFile()`、`moveFile()`、`renameFile()` 方法
  - `src/components/file/RenameDialog.tsx` - 重命名对话框组件
  - `src/components/file/MoveCopyDialog.tsx` - 移动/复制对话框组件
    - 左右分栏布局，左侧操作区 + 右侧文件夹浏览器
    - 支持跨桶移动/复制（目标桶选择器）
    - 可折叠的右侧文件夹浏览器侧边栏
    - 循环引用检测（防止文件夹移动到自身或子目录）
    - 面包屑路径导航
    - 手动输入路径支持
  - `src/components/ui/select.tsx` - shadcn/ui Select 下拉组件
  - `src/components/file/FileList.tsx` - 文件列表菜单添加重命名、移动、复制选项

### Improved
- **MoveCopyDialog 交互优化**
  - 右侧栏刷新按钮左边添加"上一层"按钮
  - 路径规范化：输入 `folder` 自动识别为 `folder/` 加载子文件夹
  - 防抖机制：手动输入路径时等待 1 秒无变更后再刷新文件夹列表
  - 按钮操作（进入文件夹、返回上一级、桶切换等）立即执行，跳过防抖
  - 面包屑导航支持点击跳转到任意层级

### Technical
- S3 CopyObject + DeleteObject 实现 Move 操作
- 文件夹是虚拟概念（以 `/` 结尾的前缀），需递归处理
- `isSelfOrDescendant()` 函数检测循环引用
- 使用 `skipDebounceRef` 区分用户输入和按钮操作

---

## [0.9.6] - 2026-03-13

### Added
- **文件图标自动识别** - 根据文件后缀名自动显示对应的 vscode-icons 图标
  - `src/assets/icons/` - 58 个文件图标 + 32 个文件夹图标（来自 vscode-icons）
  - `src/lib/fileIcons.ts` - 图标映射逻辑（精确文件名匹配 + 扩展名匹配）
  - `src/components/common/FileIcon.tsx` - 统一的文件图标组件
  - 支持常见文件类型：代码（js/ts/py/rs/go/vue/react...）、样式（css/scss/less）、配置（json/yaml/toml）、图片、视频、音频、文档、压缩包等
  - 支持特殊文件：package.json、Dockerfile、README.md、LICENSE 等
  - 支持文件夹图标：node_modules、src、dist、components、assets 等
  - 深色主题适配

### Fixed
- **滚动条缺失问题** - 修复多处区域没有滚动条导致内容无法访问的问题
  - 文件列表区域：添加 `flex-1 overflow-auto` 容器，超出显示范围的文件可滚动查看
  - 文件列表表头冻结：使用 `sticky top-0 z-10` 实现表头固定，滚动时名称/大小/时间表头保持可见
  - 侧边栏存储桶列表：添加 `flex-1 overflow-y-auto`，存储桶过多时可滚动
  - 侧边栏底部固定：传输按钮、主题切换器、设置按钮使用 `shrink-0` 固定在底部，不会被增多的存储桶挤出

### Technical
- 使用 `vite-plugin-svgr` 将 SVG 转换为 React 组件
- 使用 `import.meta.glob` 预加载所有图标（eager 模式）
- FileGrid.tsx 和 FileList.tsx 改用 FileIcon 组件
- `App.tsx` 文件列表区域添加滚动容器
- `FileList.tsx` 移除内部滚动容器，表头使用 sticky 定位
- `Sidebar.tsx` 重构布局：Logo/标题固定 + 列表可滚动 + 底部固定

---

## [0.9.5] - 2026-03-13

### Fixed
- **拖拽上传功能修复** - 修复拖拽文件到上传区域不生效的问题
  - Tauri 客户端：添加 `dragDropEnabled: false` 禁用 Tauri 默认拖拽拦截
  - 网页端：改进拖拽事件处理，添加 `stopPropagation()` 防止事件冒泡
  - 精确的边界检测，只在真正离开拖拽区域时重置状态

---

## [0.9.4] - 2026-03-13

### Added
- **下载断点续传** - 真正的断点续传，从暂停位置继续下载
  - 暂停时保存部分下载的分块数据到 IndexedDB
  - 恢复时使用 Range 请求从断点继续（而非重新下载整个分块）
  - `partialData` Map 存储部分下载的数据，新数据追加到末尾
  - 动态 Range 请求：`bytes=断点位置-分块结束`
- **分块步长配置** - 支持自定义上传/下载分块大小
  - 设置对话框新增"分块设置"区域
  - 上传分块大小：5-16 MB（S3 最小限制 5MB）
  - 下载分块大小：4-32 MB
  - 配置持久化到本地存储

### Improved
- **状态持久化** - 暂停的下载任务自动保存到 store
  - `pausedDownloads` 数组存储暂停状态（taskId、completedChunks、partialChunks、loadedBytes 等）
  - 应用重启后可恢复暂停的下载任务
- **缓存管理**
  - 已下载分块保存到 IndexedDB（跨会话持久化）
  - 部分下载的分块也保存（包含 loadedBytes 元数据）
  - 下载完成/取消时自动清理对应缓存
  - 启动时清理超过 7 天的僵尸缓存
- **UI 增强**
  - 下载任务支持暂停/恢复按钮
  - `TransferPage` 统一处理上传/下载的暂停/恢复回调

### Fixed
- **竞态条件修复** - 修复暂停时 `reader.cancel()` 不抛异常导致部分数据被错误保存的问题
  - 添加数据完整性验证：检查下载大小是否与预期一致
  - 暂停时正确处理部分数据（追加保存而非丢弃）

### Technical
- **暂停机制**：通过 `activeReaders` Map 追踪活跃流读取器，暂停时全部取消
- **恢复机制**：从 IndexedDB 加载已完成分块 + 部分分块，从断点继续下载
- **数据追加**：部分数据存储在 `partialData`，新下载的数据追加到末尾
- **缓存策略**：使用复合主键 `[taskId, chunkIndex]` 存储分块 Blob + loadedBytes 元数据
- **新增类型**：`ChunkedDownloaderState`、`PausedDownloadState`、`ResumeDownloadOptions`、`CachedChunk`、`PartialChunkState`
- **分块策略重构**：从基于文件大小阈值的分级制度改为固定步长机制
  - 新增 `calculateChunksByStep()` 函数计算分块
  - 新增常量：`DEFAULT_UPLOAD_CHUNK_STEP`、`DEFAULT_DOWNLOAD_CHUNK_STEP`、`MIN_UPLOAD_CHUNK_STEP`、`MAX_UPLOAD_CHUNK_STEP`、`MIN_DOWNLOAD_CHUNK_STEP`、`MAX_DOWNLOAD_CHUNK_STEP`、`S3_MAX_PART_COUNT`
  - configStore 新增 `uploadChunkStep`、`downloadChunkStep` 状态和 `setChunkStepSettings()` 方法
  - ChunkedUploader/ChunkedDownloader 构造函数新增 `chunkStep` 参数

---

## [0.9.3] - 2026-03-13

### Fixed
- **Sidecar 进程管理修复** - 修复桌面端关闭窗口后后端进程残留的问题
  - 使用 `CommandChild` 类型正确管理 sidecar 子进程句柄
  - 窗口关闭时显式调用 `kill()` 终止后端进程
  - 通过 `Arc<Mutex<Option<CommandChild>>>` 实现跨线程安全的进程句柄共享

### Changed
- **Sidecar 进程名统一** - 增强辨识度，与浏览器端后端服务名称一致
  - `main.rs`: `sidecar("server")` → `sidecar("r2-proxy-server")`
  - 删除旧的 `server-x86_64-pc-windows-msvc.exe` 文件
- **NSIS 安装脚本增强** - 兼容新旧进程名，确保升级时正确终止进程
  - 安装时杀掉所有可能的 sidecar 进程名（含架构后缀版本）
  - 卸载时同样支持多种进程名

### Technical
- 修复 Rust 编译错误：`kill(self)` 需要 ownership，使用 `take()` 取出而非引用
- 修复闭包 move 问题：在 `setup` 前克隆 `server_child_for_close` 给 `on_window_event` 使用

---

## [0.9.2] - 2026-03-12

### Added
- **上传暂停/恢复功能** - 支持暂停分块上传并从断点恢复
  - `ChunkedUploader.pause()` - 中断活跃 XHR 请求，返回可持久化状态
  - `ChunkedUploader.start(resumeOptions)` - 从暂停状态恢复上传
  - `ChunkedUploader.listPartsFromServer()` - 从 S3/R2 查询已上传分块
  - `uploadControllers` ref - 存储每个任务的控制器实例
  - 后端新增 `GET /multipart/parts` 端点 - 查询已上传分块列表

### Improved
- **状态持久化** - 暂停的上传任务自动保存到 localStorage/文件
  - `pausedUploads` 数组存储暂停状态（uploadId、completedParts、partSize 等）
  - 应用重启后可恢复暂停的上传任务
  - 自动检测 S3 Multipart Upload 会话过期（24小时限制）
- **UI 增强**
  - 排队中的任务添加取消按钮
  - 暂停状态的任务正确显示在上传中/下载中列表

### Technical
- **暂停机制**：通过 `activeXhrs` Map 追踪活跃请求，暂停时全部中断
- **恢复机制**：从服务器获取真实已上传分块，跳过已完成的分块
- **会话验证**：恢复前调用 `ListParts` API 验证 uploadId 是否有效
- **新增类型**：`ChunkedUploaderState`、`PausedUploadState`、`ListPartsResponse`

---

## [0.9.1] - 2026-03-12

### Improved
- **面包屑导航优化** - Win11 风格的路径折叠显示
  - 超过 3 级路径时，前面的层级折叠为下拉菜单
  - 点击 `···` 按钮展开被折叠的层级列表
  - 始终保持单行显示，避免垂直堆叠遮挡 UI

- **Header 响应式布局** - 动态切换紧凑模式
  - 宽度 < 900px 时自动切换到紧凑布局
  - 紧凑模式：只显示上传、刷新、视图切换 + "更多"菜单
  - "更多"菜单整合：批量操作（平铺）、复制路径、新建文件夹、主题切换
  - 使用 `useLayoutEffect` + `window.resize` 实现可靠检测

- **Header 按钮动效优化**
  - 所有按钮添加 AnimatePresence 进入/退出缩放动效
  - 批量操作按钮：状态切换（空/已选）动画
  - 复制路径按钮：复制前后状态切换动画
  - 刷新按钮：loading 状态切换动画
  - 上传/新建文件夹按钮：初始进入动画

- **刷新按钮 hover 动画修复**
  - 修复 hover 时灰色背景跟随旋转的问题
  - 使用 `onMouseEnter/onMouseLeave` + state 控制图标旋转
  - 背景高亮保持静止，只有图标旋转 180°

- **设置对话框动画优化**
  - 分栏切换：滑动指示框动画（layoutId + Spring 弹性）
  - 内容切换：透明度淡入淡出（mode="popLayout"）
  - 高度变化：Spring 弹性动画（stiffness: 350, damping: 30）
  - 高度与内容动画同时进行，避免"先等内部动完再突变"

### Technical
- 使用 `useLayoutEffect` 确保 DOM 挂载后同步检测宽度
- 监听 `window.resize` 事件替代 `ResizeObserver`（更可靠）
- 添加 `bucketName` 到依赖数组，确保切换桶时重新检测
- Framer Motion `layout` 属性实现容器尺寸变化动画
- `AnimatePresence mode="popLayout"` 实现内容即时切换

---

## [0.9.0] - 2026-03-12

### Added
- **多线程分块上传功能** - Phase 1 基础实现
  - `src/types/chunk.ts` - 新增上传相关类型（ChunkUploadInfo、CompletedPart、MultipartUploadSession）
  - `src/lib/abortRegistry.ts` - 全局 abort 函数注册表，实现真取消机制
  - `src/services/chunkedUpload.ts` - 分块上传核心实现
    - ChunkedUploader 类：使用 S3 Multipart Upload API
    - 支持多线程并发上传分块
    - 实时进度追踪和速度计算
    - 进度报告节流（200ms）
  - 后端 `server/index.js` 新增 4 个 Multipart API
    - `POST /multipart/initiate` - 初始化分块上传
    - `POST /multipart/upload-part` - 上传分块
    - `POST /multipart/complete` - 完成分块上传合并
    - `POST /multipart/abort` - 取消分块上传清理资源

### Improved
- **速度计算优化** - 改为基于时间间隔的瞬时速度
  - 分块上传/下载：从全程平均速度改为滑动窗口计算
  - 计算公式：`speed = deltaBytes / deltaTime`
  - 速度显示更平稳，减少跳动
- **真取消机制** - 取消上传/下载时调用实际清理函数
  - 分块上传取消：调用 `AbortMultipartUpload` 清理已上传分块
  - 普通上传取消：调用 `xhr.abort()` 中断请求
  - 下载取消：调用 `ChunkedDownloader.abort()` 或 `xhr.abort()`
- `api.uploadFile()` 新增 `onAbort` 回调参数，支持注册取消函数
- `fileService.uploadFile()` 支持 `onAbort` 参数传递
- `transferStore.cancelTask()` 改为调用 `abortTask()` 执行真取消

### Technical
- **分块上传策略**：
  - 阈值：≥ 10MB 使用分块上传
  - 分块大小：10MB（自动调整确保不超过 10000 分块限制）
  - 并发控制：使用用户配置的 `maxUploadThreads`
- **Multipart Upload 流程**：
  1. `InitiateMultipartUpload` → 获取 UploadId
  2. `UploadPart`（并发）→ 每个 Part 返回 ETag
  3. `CompleteMultipartUpload` → 合并所有 Part
  4. `AbortMultipartUpload`（取消时）→ 清理已上传分块

---

## [0.8.2] - 2026-03-12

### Improved
- **下载进度报告节流优化** - 减少 UI 更新频率，降低 CPU 占用
  - 进度回调节流间隔 200ms（之前无限制）
  - 进度日志数量减少约 60%
  - 下载速度提升约 36%（减少 React 重新渲染开销）
  - 确保最终进度始终报告（显示 100%）

### Technical
- `ChunkedDownloader` 添加 `lastReportTime` 节流变量
- 新增 `reportProgressThrottled()` 方法替代直接调用
- `PROGRESS_THROTTLE_MS = 200` 常量控制节流间隔

---

## [0.8.1] - 2026-03-12

### Added
- **传输任务排队状态图标** - `pending` 状态显示钟表+逆时针环形箭头图标
  - 直观表示任务正在等待可用线程
  - 显示"排队等待可用线程"提示文字
  - 排队任务不计入超时机制（超时只在 running 状态时生效）

### Improved
- **刷新按钮交互优化**
  - 点击刷新后显示 `Loader2` 旋转动画
  - 最小动画播放时间 1 秒（与实际加载时间取最长）
  - 添加 20 秒超时保护机制
  - 加载期间禁用重复点击

## [0.8.0] - 2026-03-12

### Fixed
- **大文件上传限制** - 修复上传超过 100MB 文件时报 `413 PayloadTooLargeError`
  - Express `express.raw()` 中间件限制从 100MB 提升到 5GB
  - 现在支持上传最大 5GB 的文件（R2 单文件限制）
- **上传进度显示** - 修复上传进度秒变 100% 的问题
  - 后端改为流式转发，前端 XHR 进度反映真实上传进度
  - 现在显示已传大小和实时速度
- **上传错误状态显示** - 修复上传失败时 UI 不显示错误的问题
  - 错误任务显示红色背景和错误信息
  - 添加关闭按钮移除错误任务
- **传输中心 UI 布局** - 修复大小/速度文字换行问题
  - 添加 `whitespace-nowrap` 防止文字挤到第二行

### Added
- **上传超时保护**
  - XHR 超时设置为 60 分钟（适应大文件慢速上传）
  - 速度过低自动取消：连续 2 分钟速度低于 10 KB/s 时自动取消上传
- **多线程分块下载功能** - Phase 1 基础实现
  - `src/types/chunk.ts` - 分块类型定义（ChunkInfo、ChunkDownloadResult）
  - `src/lib/chunkManager.ts` - 分块计算逻辑（根据文件大小自动分块）
  - `src/lib/transferLogger.ts` - 传输日志模块（任务/分块日志、进度节流）
  - `src/services/chunkedDownload.ts` - 分块下载核心实现
    - ChunkedDownloader 类：多线程并发下载
    - 支持 Range 请求分块获取
    - 自动合并分块为完整文件
  - 后端 `server/index.js` 支持 Range 请求（206 Partial Content）

### Technical
- **分块策略**：
  - < 10MB: 不分块（单线程）
  - 10-50MB: 2 分块
  - 50-200MB: 4 分块
  - \> 200MB: 8 分块
- **并发控制**：使用用户配置的 `maxDownloadThreads` 限制并发
- **进度计算**：基于已下载总字节数，实时更新进度条

---

## [0.7.0] - 2026-03-11

### Added
- **传输中心功能** - 类似百度网盘的传输管理页面
  - `src/types/transfer.ts` - 传输任务类型定义
  - `src/stores/transferStore.ts` - 传输状态管理（任务、历史记录）
  - `src/components/transfer/` - 传输中心UI组件
    - `TransferPage.tsx` - 传输页面主组件
    - `TransferTabs.tsx` - 标签页切换（上传中/下载中/已完成）
    - `TaskList.tsx` / `TaskItem.tsx` - 进行中任务列表
    - `HistoryList.tsx` / `HistoryItem.tsx` - 历史记录列表
  - Sidebar 添加"传输"入口，显示活跃任务数量徽章
  - 历史记录持久化（最近100条）

- **下载进度追踪**
  - `api.downloadFileWithProgress()` - XHR 实现带进度回调的下载
  - 单文件下载和批量下载均支持实时进度显示
  - 下载速度计算和显示

- **上传进度优化**
  - 重构 `handleUpload` 使用 transferStore
  - 重构 `handleDownload` 和 `handleBatchDownload` 使用 transferStore
  - 统一的上传/下载任务管理

### Changed
- `runWithConcurrency` 函数新增 `index` 参数支持任务索引追踪
- 设置对话框"并发"标签改为"传输"标签

### Technical
- 传输任务状态：pending / running / paused / completed / error
- 任务完成后自动移动到历史记录
- 支持并发控制的上传/下载

### Fixed
- **修复桌面端多个 Store 数据互相覆盖问题** - 每个 store 使用独立文件存储
  - `r2-manager-config` → `config.json`
  - `r2-manager-transfer` → `transfer.json`
  - 支持从旧格式 `config.json` 自动拆分迁移

---

## [0.6.2] - 2026-03-11

### Added
- **桌面端配置文件持久化** - 区分桌面端和浏览器端的配置存储方式
  - 桌面端：配置存储到用户文档文件夹 `{Documents}/CloudFlareR2-Manager/config.json`
  - 浏览器端：继续使用 localStorage
  - 自动迁移：首次运行时自动将 localStorage 数据迁移到文件系统
- `src-tauri/capabilities/default.json` - Tauri v2 文件系统权限配置
- `src/lib/isTauri.ts` - Tauri 环境检测工具
- `src/lib/tauriStorage.ts` - 混合存储适配器（智能选择存储后端）

### Changed
- `src/stores/configStore.ts` - 使用 `createHybridStorage()` 替代 `localStorage`
- Sidecar 可执行文件重命名：`server.exe` → `r2-proxy-server.exe`（提高辨识度）

### Fixed
- 安装时自动关闭旧版本应用进程（解决"文件被占用"安装失败问题）
- **修复 Documents 文件夹路径拼接错误** - `documentDir()` 返回路径无尾部斜杠导致 `DocumentsCloudFlareR2-Manager` 变成无效路径
- 修复 `fs:scope` 权限配置，允许访问 `$DOCUMENT` 目录

### Changed
- 日志文件改为覆写模式（每次启动清空，避免日志爆炸）
- 配置读写操作添加 Tauri log 输出，便于调试

### Benefits
- 桌面应用更新不会丢失配置
- 用户可以手动备份配置文件
- 跨版本配置持久化

---

## [0.6.1] - 2026-03-11

### Changed
- **Tauri v2 迁移**
  - `tauri.conf.json` - 更新为 v2 配置格式（schema、identifier、bundle 结构）
  - `Cargo.toml` - 使用独立的 Tauri v2 插件包（shell、clipboard-manager、dialog、fs、http）
  - `main.rs` - 使用 v2 API（`generate_context!()` 宏、`app.shell()` 方法）
  - Sidecar 命名简化：`binaries/server-x86_64-pc-windows-msvc` → `binaries/server`
- **服务端 CommonJS 转换** - 将 server 代码从 ES Module 转换为 CommonJS 格式
  - `server/index.js` - `import` 改为 `require`，`export` 改为 `module.exports`
  - `server/package.json` - 移除 `"type": "module"`，添加 `pkg` 配置

### Fixed
- 修复 TypeScript 未使用变量/导入错误（ConfigPage、FileGrid、useBuckets、useFiles）
- 修复 `generate_context()` 应为宏调用 `generate_context!()`
- 修复 `app_handle()` 方法需要 `use tauri::Manager` 导入
- 修复 server/package.json 缺少 `bin` 字段导致 pkg 打包失败
- **修复 pkg 打包 ES Module 失败** - `pkg` 工具对 ES Module 支持有限，导致打包后 `Cannot find module` 错误

### Documentation
- `.gitignore` - 添加 Tauri/Rust 相关忽略规则（target/、WixTools/、binaries/*.exe、.pkg-cache/）

---

## [0.6.0] - 2026-03-11

### Added
- **Tauri 桌面端打包支持**
  - 完整的 Tauri 配置 (`src-tauri/`)
  - Sidecar 方式打包 Express 服务端
  - 支持 MSI 和 NSIS 两种安装包格式
  - 中文语言安装界面

### Documentation
- `Build.md` - 详细的桌面端打包指南
- `build.bat` - 一键打包脚本（自动检查依赖）
- `src-tauri/icons/README.md` - 图标文件说明

### Scripts
- `npm run dev:tauri` - Tauri 开发模式
- `npm run build:server` - 打包服务端为可执行文件
- `npm run build:tauri` - 仅打包 Tauri
- `npm run release` - 完整打包流程（前端 + 服务端 + Tauri）

### Technical
- 使用系统 WebView2（Windows 10/11 内置）
- 打包后体积约 5-15 MB（不含 WebView2 运行时）
- Rust 后端管理 sidecar 生命周期

---

## [0.5.0] - 2026-03-11

### Added
- **深色模式支持**
  - 主题状态管理 (`themeStore.ts`) - 支持浅色/深色/跟随系统三种模式
  - 主题提供者 (`ThemeProvider.tsx`) - 统一管理主题应用到 DOM
  - Header 主题切换下拉菜单 (`ThemeToggle.tsx`) - 太阳/月亮图标切换
  - Sidebar 三段式主题切换器 - 长矩形三等分布局（浅色/跟随/深色）
  - localStorage 持久化主题设置
  - 监听系统主题变化自动切换

### Changed
- `main.tsx` - 使用 ThemeProvider 包装 App 组件
- `Sidebar.tsx` - 底部主题按钮改为三段式切换器，使用 useThemeStore
- `Header.tsx` - 添加主题切换下拉菜单
- `App.tsx` - 移除重复的主题逻辑（统一由 ThemeProvider 管理）

### Technical
- 使用 Tailwind CSS `darkMode: ['class']` 配置
- shadcn/ui CSS 变量已预定义浅色/深色两套主题
- 主题状态与 UI 组件完全解耦

---

## [0.4.0] - 2026-03-11

### Added
- **存储桶管理功能**
  - 左侧边栏"存储桶"标题旁添加创建桶按钮（+ 图标）
  - 每个桶项右侧添加三个点菜单（鼠标悬停显示）
  - 删除存储桶确认对话框（需输入桶名确认，类似 GitHub/CloudFlare 风格）
  - `DeleteBucketDialog.tsx` 组件
- **创建存储桶对话框** (`CreateBucket.tsx`)
  - 桶名称格式校验（小写字母、数字、连字符）
  - 创建成功后自动选中新桶

### Changed
- `Sidebar.tsx` - 添加桶操作下拉菜单和删除对话框
- `MainLayout.tsx` - 添加 `onDeleteBucket` prop
- `App.tsx` - 添加 `handleCreateBucket` 和 `handleDeleteBucket` 处理函数
- `bucketStore.ts` - `selectBucket` 支持 null 类型

---

## [0.3.0] - 2026-03-10

### Added
- **新建文件夹功能**
  - Header 新建文件夹按钮
  - 创建文件夹对话框 UI
  - 后端 `/api/buckets/:bucketName/folders` 端点
  - 通过上传空对象模拟文件夹（S3/R2 机制）
- 文件/文件夹行操作菜单（三个点），支持删除和下载
- 批量操作菜单（Header），支持批量删除和下载
- 全选复选框，支持全选/取消全选当前层级
- 递归删除文件夹内容
- 设置菜单中添加重启服务按钮
- **并发控制功能**
  - 设置中添加并发配置（上传/下载线程数）
  - `runWithConcurrency` 工具函数实现并发限制
  - 批量下载使用并发控制避免浏览器连接耗尽
  - 批量上传使用并发控制避免请求超时
- **设置页面标签化布局**
  - 顶部标签导航：凭证、并发、系统、危险
  - 标签按钮带图标，小屏幕自动隐藏文字
  - 选中标签高亮效果
  - 危险操作页面使用红色警告样式

### Changed
- **设置对话框重构** - 从单页滚动布局改为标签分页布局
  - 凭证配置独立页面
  - 并发设置独立页面
  - 系统操作独立页面
  - 危险操作独立页面（红色警告风格）

### Fixed
- 修复新建文件夹后显示空名字文件的问题（过滤以 `/` 结尾的对象）
- 文件夹复选框从静态图标改为真正的复选框
- 修复批量删除文件夹时无法删除的问题
- 修复 lucide-react Bucket 图标不存在的问题
- 修复 `useConfigStore()` 在 `useCallback` 内调用导致页面崩溃的问题
- 修复批量下载中 `bucket` 变量未定义的错误
- 修复 `runWithConcurrency` 工具函数清空数组导致任务丢失的 bug

---

## [0.2.0] - 2026-03-10

### Added
- **后端代理服务器** - Express.js 代理服务器解决 CORS 跨域问题
  - `server/index.js`: Express 服务器，代理所有 R2 API 请求
  - `server/package.json`: 服务端依赖配置
  - 支持操作: 配置凭证、测试连接、桶CRUD、文件CRUD、预签名URL
- **前端 API 服务** (`src/services/api.ts`)
  - 封装所有后端 API 调用
  - 统一错误处理
  - 类型安全
- **Header 组件增强**
  - 返回上一级按钮
  - 路径面包屑导航 (点击跳转)
  - 复制路径按钮 (带成功提示)
  - 半透明椭圆样式 + hover 动效
- **启动脚本更新**
  - `npm run dev`: 同时启动前后端
  - `npm run dev:client`: 仅启动前端
  - `npm run dev:server`: 仅启动后端

### Changed
- **服务层重构**
  - `bucketService.ts`: 改为调用后端代理
  - `fileService.ts`: 改为调用后端代理
  - `useFiles.ts`: 移除 S3Client 依赖
- 清理旧架构残留代码（SettingsDialog）

### Technical Decisions
1. **为什么使用后端代理?**
   - 绕过浏览器 CORS 限制
   - 凭证不暴露给浏览器 (更安全)
   - 便于后续扩展 (缓存、日志等)

2. **为什么用 Express?**
   - 轻量、简单
   - 与 AWS SDK 兼容性好
   - 开发体验优秀

---

## [0.1.0] - 2026-03-10

### Added
- **项目脚手架搭建**
  - 初始化 Vite + React + TypeScript 项目
  - 配置 Tailwind CSS 和 PostCSS
  - 配置路径别名 `@/` 指向 `src/`
- **GUI 配置功能**
  - GUI 配置页面 (`ConfigPage.tsx`) - 网页内直接配置 R2 凭证
  - 凭证持久化 (`configStore.ts`) - 使用 Zustand persist 中间件
  - 设置对话框 (`SettingsDialog.tsx`) - 查看和修改已保存的凭证
- **基础架构设计**
  - 服务层：`r2Client.ts`, `bucketService.ts`, `fileService.ts`
  - 状态层：Zustand stores (config, bucket, file)
  - 类型定义：完整的 TypeScript 类型
  - 工具函数：格式化、文件处理等
- **UI 组件库**
  - shadcn/ui 基础组件 (button, input, card, dialog 等)
  - 布局组件 (Sidebar, Header, MainLayout)
  - 业务组件 (BucketList, FileList, FileUploader 等)
  - 通用组件 (Loading, Empty, ConfirmDialog)
- **动效实现**
  - Framer Motion 动画
  - 列表项入场动画
  - 交互反馈动画

### Security
- `.gitignore` 更新，排除敏感文件
- 界面提示"凭证仅保存在本地"

### Technical Decisions
1. **为什么使用 S3 SDK？**
   - Cloudflare R2 完全兼容 S3 API
   - 官方支持，稳定可靠
   - 无需额外封装

2. **为什么使用 Zustand？**
   - 比 Redux 轻量，API 简洁
   - TypeScript 支持优秀
   - 内置 persist 中间件

3. **为什么使用 Framer Motion？**
   - 声明式动画，开发效率高
   - 性能优秀，支持手势
   - 与 React 完美集成

4. **为什么使用 localStorage？**
   - 浏览器原生支持，无需额外依赖
   - 数据持久化，关闭浏览器后仍存在
   - 不会随代码上传到 GitHub
