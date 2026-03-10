# 文件上传进度跟踪修复

## 问题描述
文件上传时进度卡在 10%，无法显示真实上传进度。

## 根本原因
`fetch` API 不支持上传进度跟踪。需要使用 `XMLHttpRequest` (XHR) 替代。

## 解决方案

### 修改 `api.ts` - 使用 XHR 替代 fetch

```typescript
uploadFile(
  bucketName: string,
  key: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; key: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = `${API_BASE}/buckets/${bucketName}/objects/${encodeURIComponent(key)}/upload`

    // 上传进度事件
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100)
        onProgress(progress)
      }
    })

    // 请求完成
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('POST', url)
    xhr.send(file)
  })
}
```

### 修改 `fileService.ts` - 传递进度回调

```typescript
async uploadFile(
  bucketName: string,
  key: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  await api.uploadFile(bucketName, key, file, onProgress)
}
```

### 修改 `App.tsx` - 使用进度更新 UI

```typescript
await fileService.uploadFile(selectedBucket, key, upload.file, (progress) => {
  setUploads((prev) =>
    prev.map((u) =>
      u.id === upload.id ? { ...u, progress } : u
    )
  )
})
```

## 相关问题修复（同一次调试）

### 问题1: AWS SDK 流式哈希错误
- **错误**: `Unable to calculate hash for flowing readable stream`
- **修复**: `requestChecksumCalculation: 'OFF'`

### 问题2: express.raw() 未解析请求
- **错误**: `Received an instance of Object`
- **修复**: `express.raw({ type: () => true, limit: '100mb' })`

### 问题3: Content-Type 被覆盖
- **原因**: 前端默认设置 `application/json`
- **修复**: 不显式设置，让浏览器自动处理

## 最终状态 (2026-03-10) ✅
- **小文件上传**: ✅ 正常
- **大文件上传**: ✅ 正常
- **进度显示**: ✅ 实时更新（XHR）
