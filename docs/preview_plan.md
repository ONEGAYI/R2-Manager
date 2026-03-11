# 文件预览功能实现规划

> 版本: 1.1
> 创建日期: 2026-03-11
> 最后更新: 2026-03-11
> 状态: 规划中

## 修订记录

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| 1.1 | 2026-03-11 | 文件大小限制从 100MB 下调至 20MB；重构缓存策略为会话级隔离 |
| 1.0 | 2026-03-11 | 初始版本 |

## 概述

为 Cloudflare R2 Manager 添加文件预览功能，支持浏览器端和 Tauri 桌面端两种环境，根据文件类型智能选择最佳预览方式。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     FilePreview 组件                         │
├─────────────────────────────────────────────────────────────┤
│  1. 检测文件类型 → 选择预览策略                               │
│  2. 获取预签名 URL 或下载内容                                 │
│  3. 渲染预览 UI / 调用系统应用                                │
└─────────────────────────────────────────────────────────────┘
          │
          ├── 浏览器端: Modal/Drawer 内嵌预览
          │
          └── Tauri 桌面端:
               ├── 媒体文件 → WebView2 内嵌预览（同浏览器）
               └── 其他文件 → 下载临时文件 + shell.open()
```

---

## 文件类型分类与预览策略

### 类型 A: 浏览器原生支持（优先级最高）

| 文件类型 | 扩展名 | 预览方式 | 需要下载 |
|---------|-------|---------|---------|
| 图片 | jpg, jpeg, png, gif, webp, svg, bmp, ico | `<img>` + Lightbox | ❌ |
| 视频 | mp4, webm, ogg | `<video>` | ❌ |
| 音频 | mp3, wav, ogg, flac, aac | `<audio>` | ❌ |
| PDF | pdf | iframe / 新窗口 / PDF.js | ❌ |

**实现方式**: 使用预签名 URL 直接嵌入 HTML 元素

### 类型 B: 文本类文件

| 文件类型 | 扩展名 | 预览方式 | 需要下载 |
|---------|-------|---------|---------|
| 纯文本 | txt, log, md | 代码高亮显示 | ⚠️ 内存 |
| 代码 | js, ts, py, rs, go, java, c, cpp, h, json, xml, yaml, html, css, sql | Monaco Editor / Prism.js | ⚠️ 内存 |
| 数据 | csv, tsv | 表格展示 | ⚠️ 内存 |

**实现方式**:
1. 通过 API 获取文件内容（限制大小，如 1MB 以内）
2. 前端渲染带语法高亮的文本

### 类型 C: 需要系统应用打开（Tauri 专用）

| 文件类型 | 扩展名 | 预览方式 | 需要下载 |
|---------|-------|---------|---------|
| Office | docx, xlsx, pptx, doc, xls, ppt | 系统默认应用 | ✅ 临时文件 |
| 压缩包 | zip, rar, 7z, tar, gz | 系统默认应用 | ✅ 临时文件 |
| 其他 | 任意 | 系统默认应用 | ✅ 临时文件 |

**实现方式**:
1. 下载文件到本地临时目录
2. 调用 `shell.open()` 用系统应用打开
3. 用户关闭后自动清理（或定期清理）

---

## 本地缓存策略（Tauri 桌面端）

### 核心原则

> **缓存仅用于同一会话内的重复预览，任何导致文件列表变化的操作都会清空缓存**

这样设计的原因：
- R2 文件可能随时被修改，缓存无法保证时效性
- 避免复杂的缓存失效判断逻辑
- 确保用户看到的始终是最新文件内容

### 1. 文件大小限制

```
┌─────────────────────────────────────────┐
│           文件大小检查流程                │
├─────────────────────────────────────────┤
│  文件大小 ≤ 20MB   →  允许下载预览       │
│  文件大小 > 20MB   →  提示用户手动下载   │
└─────────────────────────────────────────┘
```

**限制原因**:
- 20MB 足以覆盖大多数文档、图片预览需求
- 避免大文件占用过多带宽和磁盘空间
- 防止下载超时影响用户体验
- 更严格的限制意味着更频繁的清理，减少磁盘堆积

**用户提示文案**:
```
文件过大 (xxx MB)，超过 20MB 预览限制。
建议直接下载到本地后查看。
[ 下载文件 ]
```

### 2. 缓存目录结构

```
{TempDir}/
└── r2-manager-preview/
    ├── {session_id}/              # 按会话隔离
    │   ├── {bucket}_{hash}.pdf
    │   ├── {bucket}_{hash}.docx
    │   └── ...
    └── sessions.json              # 会话注册表
```

**路径示例 (Windows)**:
```
C:\Users\{User}\AppData\Local\Temp\r2-manager-preview\
```

### 3. 会话管理

```typescript
interface SessionRegistry {
  currentSessionId: string;      // 当前活跃会话
  sessions: {
    [sessionId: string]: {
      createdAt: string;         // ISO 日期
      bucketName: string;        // 关联的桶名
      path: string;              // 当前浏览路径
    }
  }
}
```

### 4. 清理机制（核心）

#### 4.1 触发完全清理的时机

| 触发事件 | 说明 | 清理范围 |
|---------|------|---------|
| **刷新文件列表** | 用户点击刷新按钮 | 当前会话所有缓存 |
| **切换存储桶** | 选择不同的桶 | 当前会话所有缓存 |
| **切换目录** | 进入不同路径 | 可选：仅清理当前目录相关 |
| **重启应用** | 应用重新启动 | 所有会话缓存 |
| **关闭应用** | 应用退出 | 所有会话缓存 |
| **手动清理** | 设置页面触发 | 所有会话缓存 |

#### 4.2 可复用缓存的场景

仅在**同一会话内**且**文件列表未变化**时复用：

| 场景 | 是否复用 |
|-----|---------|
| 预览同一文件第二次 | ✅ 复用 |
| 预览后关闭预览窗口，再打开同一文件 | ✅ 复用 |
| 预览后切换到其他文件，再切回来 | ✅ 复用 |
| 刷新文件列表后预览 | ❌ 重新下载 |
| 切换桶后预览 | ❌ 重新下载 |
| 重启应用后预览 | ❌ 重新下载 |

#### 4.3 清理流程伪代码

```rust
// Tauri Rust 后端

/// 创建新会话（应用启动时调用）
fn create_session(bucket_name: &str) -> String {
    let session_id = uuid::Uuid::new_v4().to_string();
    let session_dir = get_cache_dir().join(&session_id);
    fs::create_dir_all(&session_dir)?;

    // 注册会话
    let mut registry = load_registry()?;
    registry.current_session_id = session_id.clone();
    registry.sessions.insert(session_id.clone(), SessionInfo {
        created_at: now(),
        bucket_name: bucket_name.to_string(),
        path: "/".to_string(),
    });
    save_registry(&registry)?;

    session_id
}

/// 完全清理当前会话缓存（刷新/切换桶时调用）
fn clear_session_cache() -> Result<()> {
    let registry = load_registry()?;
    if let Some(session_id) = &registry.current_session_id {
        let session_dir = get_cache_dir().join(session_id);
        if session_dir.exists() {
            fs::remove_dir_all(&session_dir)?;
            fs::create_dir_all(&session_dir)?;
        }
    }
    Ok(())
}

/// 完全清理所有缓存（重启/关闭/手动清理时调用）
fn clear_all_cache() -> Result<u64> {
    let cache_dir = get_cache_dir()?;
    let mut total_freed = 0;

    if cache_dir.exists() {
        // 计算释放空间
        for entry in fs::read_dir(&cache_dir)? {
            if let Ok(entry) = entry {
                if entry.path().is_dir() {
                    total_freed += get_dir_size(&entry.path())?;
                }
            }
        }
        // 删除所有内容
        fs::remove_dir_all(&cache_dir)?;
        fs::create_dir_all(&cache_dir)?;
    }

    // 清空会话注册表
    save_registry(&SessionRegistry::default())?;

    Ok(total_freed)
}

/// 应用启动时清理残留
fn startup_cleanup() -> Result<()> {
    // 上次应用可能未正常退出，清理所有残留缓存
    clear_all_cache()?;
    Ok(())
}

/// 应用退出时清理
fn on_app_exit() -> Result<()> {
    clear_all_cache()?;
    Ok(())
}
```

### 5. 前端集成

```typescript
// hooks/useFileList.ts 或类似位置

const refreshFileList = async () => {
  // 清理预览缓存
  if (isTauri()) {
    await tauriInvoke('clear_session_cache');
  }

  // 然后获取最新文件列表
  await fetchFiles();
};

const switchBucket = async (bucketName: string) => {
  // 切换桶前清理缓存
  if (isTauri()) {
    await tauriInvoke('clear_session_cache');
  }

  // 切换桶
  setCurrentBucket(bucketName);
};
```

---

## 分层实现计划

### Phase 1: 基础预览（浏览器端 + Tauri 共用）

**目标**: 实现最常见的文件类型预览

- [ ] **图片预览器** (`ImagePreview.tsx`)
  - Lightbox 模态框
  - 缩放、拖拽、全屏
  - 支持格式: jpg, png, gif, webp, svg

- [ ] **视频预览器** (`VideoPreview.tsx`)
  - 内置播放器控件
  - 支持格式: mp4, webm

- [ ] **音频预览器** (`AudioPreview.tsx`)
  - 带封面的音频播放器
  - 支持格式: mp3, wav, ogg, flac

- [ ] **PDF 预览器** (`PdfPreview.tsx`)
  - iframe 嵌入或新窗口打开
  - 可选: 集成 PDF.js 实现更好的控制

- [ ] **文本预览器** (`TextPreview.tsx`)
  - 代码语法高亮 (Prism.js / Shiki)
  - 行号显示
  - 文件大小限制: 1MB

### Phase 2: Tauri 桌面端增强

**目标**: 利用系统能力扩展预览支持

- [ ] **系统应用打开** (`openWithSystemApp`)
  - Rust 命令: 下载 → 临时文件 → shell.open()
  - 20MB 大小检查
  - 下载进度提示

- [ ] **缓存管理系统**
  - 缓存元数据记录
  - 应用启动时自动清理过期文件
  - 设置页面: 显示缓存大小、手动清理按钮

- [ ] **预览模式切换**
  - "内嵌预览" vs "系统应用打开" 选项
  - 记住用户偏好

### Phase 3: 高级预览（可选）

**目标**: 提升用户体验

- [ ] **Office 文档预览**
  - 方案 A: 使用第三方服务 (如 Microsoft Office Online Viewer)
  - 方案 B: 仅提供下载链接

- [ ] **Markdown 渲染**
  - 实时渲染 Markdown 为 HTML
  - 支持 GitHub Flavored Markdown

- [ ] **CSV 表格预览**
  - 表格形式展示
  - 支持排序、搜索

- [ ] **图片 EXIF 信息展示**
  - 显示拍摄参数
  - GPS 位置信息（如有）

---

## API 设计

### 前端 API

```typescript
// services/previewService.ts

interface PreviewService {
  // 获取预签名 URL（用于媒体文件）
  getPreviewUrl(key: string, expiresIn?: number): Promise<string>;

  // 获取文件内容（用于文本文件）
  getFileContent(key: string, maxSize?: number): Promise<string>;

  // 用系统应用打开（仅 Tauri）
  openWithSystemApp?(key: string, filename: string): Promise<void>;

  // 获取缓存状态（仅 Tauri）
  getCacheStatus?(): Promise<CacheStatus>;

  // 清理当前会话缓存（仅 Tauri）
  clearSessionCache?(): Promise<void>;

  // 清理所有缓存（仅 Tauri）
  clearAllCache?(): Promise<number>;  // 返回释放的字节数
}

interface CacheStatus {
  sessionCacheSize: number;   // 当前会话缓存大小（字节）
  sessionFileCount: number;   // 当前会话文件数量
  totalCacheSize: number;     // 总缓存大小（字节）
}
```

### Tauri 命令 (Rust)

```rust
// src-tauri/src/commands/preview.rs

#[tauri::command]
async fn open_with_system_app(
    bucket: String,
    key: String,
    filename: String,
    file_size: u64,
) -> Result<(), String> {
    // 1. 检查文件大小
    const MAX_PREVIEW_SIZE: u64 = 20 * 1024 * 1024; // 20MB
    if file_size > MAX_PREVIEW_SIZE {
        return Err(format!("文件超过 20MB 限制（当前 {}）", format_size(file_size)));
    }

    // 2. 下载文件到当前会话的临时目录
    let temp_path = download_to_session_cache(&bucket, &key, &filename).await?;

    // 3. 用系统应用打开
    opener::open(&temp_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_cache_status() -> Result<CacheStatus, String> {
    // 返回缓存统计信息
}

#[tauri::command]
fn clear_session_cache() -> Result<(), String> {
    // 清理当前会话的缓存
}

#[tauri::command]
fn clear_all_cache() -> Result<u64, String> {
    // 清理所有缓存，返回释放的字节数
}
```

---

## UI 设计

### 预览入口

1. **文件列表**: 每行双击 → 打开预览
2. **操作菜单**: 三个点 → "预览" 选项
3. **工具栏**: 选中文件后 → "预览" 按钮

### 预览窗口

```
┌────────────────────────────────────────────────────────────┐
│  ←  预览: document.pdf                    [系统打开] [下载] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│                    [预览内容区域]                           │
│                                                            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  文件: document.pdf  |  大小: 2.5 MB  |  修改: 2026-03-11  │
└────────────────────────────────────────────────────────────┘
```

### 超大文件提示

```
┌────────────────────────────────────────┐
│           ⚠️ 文件过大                   │
├────────────────────────────────────────┤
│                                        │
│  该文件大小为 256 MB，超过 20 MB        │
│  的预览限制。                           │
│                                        │
│  建议下载到本地后使用相应软件打开。      │
│                                        │
│         [ 取消 ]    [ 下载文件 ]        │
└────────────────────────────────────────┘
```

---

## 依赖库

### 前端

| 库 | 用途 | 大小 |
|---|------|-----|
| `react-zoom-pan-pinch` | 图片缩放拖拽 | ~10KB |
| `prismjs` / `shiki` | 代码高亮 | ~50KB |
| `react-pdf` (可选) | PDF 内嵌渲染 | ~200KB |

### Tauri (Rust)

| 库 | 用途 |
|---|------|
| `opener` | 系统默认应用打开文件 |
| `serde_json` | 缓存元数据序列化 |
| `reqwest` | 文件下载 |

---

## 测试计划

### 功能测试

- [ ] 图片预览: 各种格式、大图、动图
- [ ] 视频/音频播放: 播放控制、进度条
- [ ] 文本预览: 各种代码语言高亮
- [ ] PDF 预览: 多页 PDF 翻页
- [ ] 大文件拦截: >20MB 文件正确提示
- [ ] 缓存清理: 过期文件自动删除

### 边界测试

- [ ] 空文件预览
- [ ] 超长文件名
- [ ] 特殊字符文件名
- [ ] 网络中断时的错误处理
- [ ] 并发预览多个文件

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 大文件下载卡顿 | 用户体验差 | 20MB 限制 + 进度提示 |
| 缓存占用过多磁盘 | 用户投诉 | 会话结束时自动清理 + 手动清理 |
| 文件类型判断错误 | 预览失败 | MIME 类型 + 扩展名双重判断 |
| 系统应用无法打开 | 用户困惑 | 错误提示 + 建议下载 |

---

## 后续优化方向

1. **预加载**: 鼠标悬停时预加载缩略图
2. **缩略图缓存**: 图片/视频生成缩略图存储
3. **离线预览**: 常用文件缓存到本地
4. **预览历史**: 记录最近预览的文件
