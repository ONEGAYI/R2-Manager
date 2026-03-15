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

## 二、已实现功能

### Phase 1：基础功能 ✅ v0.9.7

单文件复制/移动/重命名、跨桶操作、循环引用检测、文件夹浏览器、面包屑导航

### Phase 2：批量操作 ✅ v0.9.8 - v0.9.15

- 批量复制/移动（集成传输中心）
- SSE 实时进度反馈
- 进度气泡组件（Hover 展开子项详情）
- 批量冲突检测（ListObjects 优化方案）
- 并行处理（可配置并发数 1-8）

### Phase 3：冲突处理增强 ✅ v0.9.16 → v1.1.0

#### 冲突处理策略

```typescript
type ConflictStrategy =
  | 'skip'        // 跳过冲突项
  | 'overwrite'   // 覆盖目标
  | 'rename'      // 自动重命名（保留两者）
  | 'ask'         // 逐个询问（默认）
```

#### 冲突对话框

参考 Windows 10/11 设计，支持：
- 显示源/目标文件详细信息（大小、修改时间）
- 每个冲突项独立选择处理策略（跳过 / 覆盖 / 保留两者）
- "全部设为"快捷按钮（全部跳过 / 全部保留 / 全部覆盖）
- 策略统计显示（X 项跳过、X 项保留、X 项覆盖）
- 根据选择的策略显示不同背景色高亮

#### 逐项策略支持 ✅ v1.1.0

后端支持为每个冲突文件指定独立的处理策略：

```typescript
// 逐项策略映射
const itemStrategies: Record<string, 'skip' | 'overwrite' | 'rename'> = {
  'folder/file1.txt': 'overwrite',
  'folder/file2.txt': 'rename',
  'folder/file3.txt': 'skip',
}
```

**实现细节：**
- `getItemStrategy(key, globalStrategy, itemStrategiesMap)` - 逐项策略优先于全局策略
- 冲突检测前过滤：只检测策略为 `rename` 或 `ask` 的文件（减少不必要的 API 调用）

#### 自动重命名

```
目标: folder/file.txt (已存在)
→ folder/file (1).txt

目标: folder/file.txt (file (1).txt 也存在)
→ folder/file (2).txt
```

后端实现：
- `findAvailableName()` - 生成唯一文件名
- `generateUniqueNamesBatch()` - 批量预生成重命名映射

#### 操作结果详情

历史记录支持展开查看批量操作详情：
- 统计标签：成功 / 重命名 / 跳过 / 失败
- `OperationResultDetails` 组件展示详细列表
- 支持 `partial` 状态（部分成功）

### Phase 4：上传冲突检测 ✅ v1.1.0

上传文件时自动检测同名文件冲突：

- 上传前调用 `/detect-conflicts` API 检测目标位置同名文件
- 有冲突时弹出 ConflictDialog 让用户选择处理方式
- 支持跳过、重命名（自动添加 `(1)` 后缀）、覆盖

```
上传: file.txt (目标已存在)
→ 跳过: 不上传
→ 保留两者: 上传为 file (1).txt
→ 覆盖: 直接覆盖原文件
```

---

## 三、性能优化记录

### 批量冲突检测优化 ✅ v0.9.12

| 方案 | 请求数 | 耗时（100 项） |
|------|--------|----------------|
| 逐个 HeadObject | 100 次 | ~10-15s |
| 批量 ListObjects | ~5-10 次 | ~1-2s |

**结论**：使用 ListObjects 批量获取目录文件列表，本地检测冲突

### 并行处理优化 ✅ v0.9.13

- 使用 `runWithConcurrency()` 并发执行器
- `Semaphore` 信号量控制总并发数
- 用户可配置并发数（1-8，默认 4）

### SSE 实时进度优化 ✅ v0.9.16

- 新增 `itemComplete` 事件类型
- 每个子项完成后立即通知前端
- 前端实时更新子项状态（无需等待操作全部完成）

---

## 四、参考设计

- Windows 10/11 文件资源管理器
- macOS Finder
- Google Drive 文件操作
- Dropbox 文件同步冲突处理
