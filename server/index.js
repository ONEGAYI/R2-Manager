const express = require('express')
const cors = require('cors')
const { spawn } = require('child_process')
const {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  // Copy/Move Commands
  CopyObjectCommand,
  HeadObjectCommand,
  // Multipart Upload Commands
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const app = express()
app.use(cors())
// 仅对非上传请求使用 JSON 解析
app.use((req, res, next) => {
  // 上传端点使用 raw 解析，跳过 JSON 中间件
  if (req.path.includes('/upload') && req.method === 'POST') {
    return next()
  }
  express.json()(req, res, next)
})

// 存储客户端实例和凭证
let r2Client = null
let currentCredentials = null

// 初始化 R2 客户端
function createClient(credentials) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    // 禁用 chunked encoding 以避免流式哈希问题
    requestChecksumCalculation: 'OFF',
  })
}

// API: 配置凭证
app.post('/api/config', (req, res) => {
  const { accountId, accessKeyId, secretAccessKey } = req.body

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return res.status(400).json({ error: '缺少必要的凭证参数' })
  }

  try {
    currentCredentials = { accountId, accessKeyId, secretAccessKey }
    r2Client = createClient(currentCredentials)
    res.json({ success: true, message: '客户端配置成功' })
  } catch (error) {
    console.error('配置失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 测试连接
app.get('/api/test', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  try {
    const command = new ListBucketsCommand({})
    await r2Client.send(command)
    res.json({ success: true, message: '连接成功' })
  } catch (error) {
    console.error('测试连接失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 获取存储桶列表
app.get('/api/buckets', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  try {
    const command = new ListBucketsCommand({})
    const response = await r2Client.send(command)
    const buckets = (response.Buckets || []).map((bucket) => ({
      name: bucket.Name,
      creationDate: bucket.CreationDate?.toISOString() || '',
    }))
    res.json({ buckets })
  } catch (error) {
    console.error('获取存储桶列表失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 创建存储桶
app.post('/api/buckets', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.body
  if (!bucketName) {
    return res.status(400).json({ error: '缺少存储桶名称' })
  }

  try {
    const command = new CreateBucketCommand({ Bucket: bucketName })
    await r2Client.send(command)
    res.json({ success: true, message: '存储桶创建成功' })
  } catch (error) {
    console.error('创建存储桶失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 删除存储桶
app.delete('/api/buckets/:bucketName', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.params

  try {
    const command = new DeleteBucketCommand({ Bucket: bucketName })
    await r2Client.send(command)
    res.json({ success: true, message: '存储桶删除成功' })
  } catch (error) {
    console.error('删除存储桶失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 列出对象
app.get('/api/buckets/:bucketName/objects', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.params
  const { prefix = '' } = req.query

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: 1000,
    })
    const response = await r2Client.send(command)

    const objects = (response.Contents || []).map((obj) => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified?.toISOString() || '',
      etag: obj.ETag,
    }))

    const prefixes = (response.CommonPrefixes || []).map((p) => p.Prefix)

    res.json({ objects, prefixes })
  } catch (error) {
    console.error('列出对象失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 获取下载 URL
app.get('/api/buckets/:bucketName/objects/:key(*)/url', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params

  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 })
    res.json({ url })
  } catch (error) {
    console.error('获取下载 URL 失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 代理下载文件（解决跨域下载问题，支持 Range 请求）
app.get('/api/buckets/:bucketName/objects/:key(*)/download', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params
  const rangeHeader = req.headers['range']

  try {
    // 构建命令参数，支持 Range 请求
    const commandParams = { Bucket: bucketName, Key: key }
    if (rangeHeader) {
      commandParams.Range = rangeHeader
    }

    const command = new GetObjectCommand(commandParams)
    const response = await r2Client.send(command)

    // 获取文件名（从 key 中提取最后一部分）
    const filename = key.split('/').pop() || 'download'

    // 设置响应头，强制下载
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.setHeader('Content-Type', response.ContentType || 'application/octet-stream')

    // 处理 Range 请求响应
    if (rangeHeader && response.ContentRange) {
      res.status(206) // Partial Content
      res.setHeader('Content-Range', response.ContentRange)
      res.setHeader('Accept-Ranges', 'bytes')
      // ContentLength 在 Range 请求时是分块大小
      if (response.ContentLength) {
        res.setHeader('Content-Length', response.ContentLength)
      }
    } else {
      // 完整请求
      if (response.ContentLength) {
        res.setHeader('Content-Length', response.ContentLength)
      }
      res.setHeader('Accept-Ranges', 'bytes')
    }

    // 将流管道到响应
    const stream = response.Body
    if (stream && typeof stream.pipe === 'function') {
      stream.pipe(res)
    } else if (stream instanceof Uint8Array) {
      // 处理 Uint8Array 类型
      res.send(Buffer.from(stream))
    } else {
      // 处理其他类型
      res.send(stream)
    }
  } catch (error) {
    console.error('下载文件失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 获取上传 URL
app.post('/api/buckets/:bucketName/objects/:key(*)/upload-url', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params
  const { contentType } = req.body

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    })
    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 })
    res.json({ url })
  } catch (error) {
    console.error('获取上传 URL 失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 直接上传文件（通过后端代理，避免CORS）
// 支持 5GB 大文件上传（R2 单文件最大限制）
// 使用流式转发，前端进度反映真实上传进度
app.post('/api/buckets/:bucketName/objects/:key(*)/upload', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params

  try {
    const contentType = req.headers['content-type'] || 'application/octet-stream'
    const contentLength = parseInt(req.headers['content-length'] || '0', 10)

    console.log('[Upload] Bucket:', bucketName, 'Key:', key, 'Size:', contentLength, 'Type:', contentType)

    // 直接使用请求流转发到 R2（流式转发）
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: req, // 直接使用请求流
      ContentType: contentType,
      ContentLength: contentLength,
    })

    await r2Client.send(command)
    console.log('[Upload] Success:', key)
    res.json({ success: true, key })
  } catch (error) {
    console.error('上传文件失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 删除对象（支持递归删除文件夹）
app.delete('/api/buckets/:bucketName/objects/:key(*)', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params

  try {
    // 检查是否是文件夹（以 / 结尾）
    if (key.endsWith('/')) {
      // 递归删除文件夹：先列出所有对象，再批量删除
      let allKeys = []
      let continuationToken = undefined

      // 列出该前缀下的所有对象
      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: key,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
        const listResponse = await r2Client.send(listCommand)

        if (listResponse.Contents) {
          allKeys = allKeys.concat(listResponse.Contents.map((obj) => obj.Key))
        }

        continuationToken = listResponse.NextContinuationToken
      } while (continuationToken)

      if (allKeys.length === 0) {
        return res.json({ success: true, message: '文件夹为空', deleted: 0 })
      }

      // 批量删除（每次最多 1000 个）
      let deletedCount = 0
      for (let i = 0; i < allKeys.length; i += 1000) {
        const batch = allKeys.slice(i, i + 1000)
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: batch.map((k) => ({ Key: k })),
            Quiet: false,
          },
        })
        const deleteResponse = await r2Client.send(deleteCommand)
        deletedCount += (deleteResponse.Deleted || []).length
      }

      res.json({
        success: true,
        message: `文件夹删除成功，共删除 ${deletedCount} 个对象`,
        deleted: deletedCount,
      })
    } else {
      // 删除单个文件
      const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key })
      await r2Client.send(command)
      res.json({ success: true, message: '文件删除成功', deleted: 1 })
    }
  } catch (error) {
    console.error('删除对象失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 批量删除对象（支持文件夹递归删除）
app.post('/api/buckets/:bucketName/objects/batch-delete', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.params
  const { keys } = req.body // keys 是要删除的对象 key 数组

  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return res.status(400).json({ error: '请提供要删除的对象列表' })
  }

  try {
    let allKeysToDelete = []

    // 处理每个 key，对于文件夹需要展开获取所有子对象
    for (const key of keys) {
      if (key.endsWith('/')) {
        // 文件夹：列出所有子对象
        let continuationToken = undefined
        do {
          const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: key,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          })
          const listResponse = await r2Client.send(listCommand)

          if (listResponse.Contents) {
            allKeysToDelete = allKeysToDelete.concat(
              listResponse.Contents.map((obj) => obj.Key)
            )
          }

          continuationToken = listResponse.NextContinuationToken
        } while (continuationToken)
      } else {
        // 普通文件
        allKeysToDelete.push(key)
      }
    }

    if (allKeysToDelete.length === 0) {
      return res.json({
        success: true,
        deleted: [],
        errors: [],
        message: '没有需要删除的对象',
      })
    }

    // 批量删除（每次最多 1000 个）
    let deletedKeys = []
    let errors = []

    for (let i = 0; i < allKeysToDelete.length; i += 1000) {
      const batch = allKeysToDelete.slice(i, i + 1000)
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map((k) => ({ Key: k })),
          Quiet: false,
        },
      })
      const deleteResponse = await r2Client.send(deleteCommand)

      if (deleteResponse.Deleted) {
        deletedKeys = deletedKeys.concat(deleteResponse.Deleted.map((obj) => obj.Key))
      }
      if (deleteResponse.Errors) {
        errors = errors.concat(
          deleteResponse.Errors.map((err) => ({
            key: err.Key,
            message: err.Message,
          }))
        )
      }
    }

    res.json({
      success: true,
      deleted: deletedKeys,
      errors,
      message: `成功删除 ${deletedKeys.length} 个对象${errors.length > 0 ? `，${errors.length} 个失败` : ''}`,
    })
  } catch (error) {
    console.error('批量删除失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 创建文件夹（上传一个以 / 结尾的空对象）
app.post('/api/buckets/:bucketName/folders', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.params
  const { folderPath } = req.body

  if (!folderPath) {
    return res.status(400).json({ error: '缺少文件夹路径' })
  }

  // 确保文件夹路径以 / 结尾
  const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: normalizedPath,
      Body: Buffer.alloc(0), // 空内容
      ContentType: 'application/x-directory',
    })
    await r2Client.send(command)
    res.json({ success: true, message: '文件夹创建成功', path: normalizedPath })
  } catch (error) {
    console.error('创建文件夹失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// ==================== Copy/Move APIs ====================

// API: 复制对象（支持文件夹递归复制，支持跨桶）
app.post('/api/buckets/:bucketName/objects/:key(*)/copy', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key: sourceKey } = req.params
  const { destinationKey, destinationBucket, overwrite = false } = req.body

  if (!destinationKey) {
    return res.status(400).json({ error: '缺少目标路径' })
  }

  // 目标桶（如果没有指定则使用源桶）
  const targetBucket = destinationBucket || bucketName

  try {
    // 检查是否是文件夹（以 / 结尾）
    if (sourceKey.endsWith('/')) {
      // 文件夹复制：递归复制所有子对象
      let allObjects = []
      let continuationToken = undefined

      // 列出该前缀下的所有对象
      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: sourceKey,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
        const listResponse = await r2Client.send(listCommand)

        if (listResponse.Contents) {
          allObjects = allObjects.concat(listResponse.Contents)
        }

        continuationToken = listResponse.NextContinuationToken
      } while (continuationToken)

      if (allObjects.length === 0) {
        // 空文件夹，只创建目标文件夹标记
        const command = new CopyObjectCommand({
          Bucket: targetBucket,
          CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
          Key: destinationKey,
        })
        await r2Client.send(command)
        return res.json({
          success: true,
          message: '空文件夹复制成功',
          copied: 1,
        })
      }

      // 逐个复制子对象
      let copiedCount = 0
      for (const obj of allObjects) {
        const relativePath = obj.Key.substring(sourceKey.length)
        const targetKey = `${destinationKey}${relativePath}`

        // 冲突检测
        if (!overwrite) {
          try {
            const headCommand = new HeadObjectCommand({
              Bucket: targetBucket,
              Key: targetKey,
            })
            await r2Client.send(headCommand)
            // 目标已存在，返回冲突错误
            return res.status(409).json({
              error: '目标路径已存在',
              conflictKey: targetKey,
            })
          } catch (headError) {
            // 目标不存在，可以继续复制
            if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
              throw headError
            }
          }
        }

        const copyCommand = new CopyObjectCommand({
          Bucket: targetBucket,
          CopySource: `${bucketName}/${encodeURIComponent(obj.Key)}`,
          Key: targetKey,
        })
        await r2Client.send(copyCommand)
        copiedCount++
      }

      res.json({
        success: true,
        message: `文件夹复制成功，共复制 ${copiedCount} 个对象`,
        copied: copiedCount,
      })
    } else {
      // 单文件复制
      // 冲突检测
      if (!overwrite) {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: targetBucket,
            Key: destinationKey,
          })
          await r2Client.send(headCommand)
          // 目标已存在，返回冲突错误
          return res.status(409).json({
            error: '目标路径已存在',
            conflictKey: destinationKey,
          })
        } catch (headError) {
          // 目标不存在，可以继续复制
          if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
            throw headError
          }
        }
      }

      const command = new CopyObjectCommand({
        Bucket: targetBucket,
        CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
        Key: destinationKey,
      })
      await r2Client.send(command)

      res.json({
        success: true,
        message: '文件复制成功',
        copied: 1,
        key: destinationKey,
        bucket: targetBucket,
      })
    }
  } catch (error) {
    console.error('复制对象失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 移动对象（复制后删除源，支持跨桶）
app.post('/api/buckets/:bucketName/objects/:key(*)/move', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key: sourceKey } = req.params
  const { destinationKey, destinationBucket, overwrite = false } = req.body

  if (!destinationKey) {
    return res.status(400).json({ error: '缺少目标路径' })
  }

  // 目标桶（如果没有指定则使用源桶）
  const targetBucket = destinationBucket || bucketName

  // 防止同桶移动到自身
  if (bucketName === targetBucket && sourceKey === destinationKey) {
    return res.status(400).json({ error: '源路径和目标路径不能相同' })
  }

  // 防止同桶文件夹移动到自身子目录
  if (bucketName === targetBucket && sourceKey.endsWith('/') && destinationKey.startsWith(sourceKey)) {
    return res.status(400).json({ error: '不能将文件夹移动到自身或子目录中' })
  }

  try {
    // 检查是否是文件夹（以 / 结尾）
    if (sourceKey.endsWith('/')) {
      // 文件夹移动：递归复制后删除源
      let allObjects = []
      let continuationToken = undefined

      // 列出该前缀下的所有对象
      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: sourceKey,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
        const listResponse = await r2Client.send(listCommand)

        if (listResponse.Contents) {
          allObjects = allObjects.concat(listResponse.Contents)
        }

        continuationToken = listResponse.NextContinuationToken
      } while (continuationToken)

      if (allObjects.length === 0) {
        // 空文件夹，只创建目标文件夹标记并删除源
        const copyCommand = new CopyObjectCommand({
          Bucket: targetBucket,
          CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
          Key: destinationKey,
        })
        await r2Client.send(copyCommand)

        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: sourceKey,
        })
        await r2Client.send(deleteCommand)

        return res.json({
          success: true,
          message: '空文件夹移动成功',
          moved: 1,
        })
      }

      // 逐个复制子对象
      let movedCount = 0
      const copiedKeys = []

      for (const obj of allObjects) {
        const relativePath = obj.Key.substring(sourceKey.length)
        const targetKey = `${destinationKey}${relativePath}`

        // 冲突检测
        if (!overwrite) {
          try {
            const headCommand = new HeadObjectCommand({
              Bucket: targetBucket,
              Key: targetKey,
            })
            await r2Client.send(headCommand)
            // 目标已存在，返回冲突错误
            return res.status(409).json({
              error: '目标路径已存在',
              conflictKey: targetKey,
            })
          } catch (headError) {
            // 目标不存在，可以继续复制
            if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
              throw headError
            }
          }
        }

        const copyCommand = new CopyObjectCommand({
          Bucket: targetBucket,
          CopySource: `${bucketName}/${encodeURIComponent(obj.Key)}`,
          Key: targetKey,
        })
        await r2Client.send(copyCommand)
        copiedKeys.push(obj.Key)
        movedCount++
      }

      // 批量删除源对象
      for (let i = 0; i < copiedKeys.length; i += 1000) {
        const batch = copiedKeys.slice(i, i + 1000)
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: batch.map((k) => ({ Key: k })),
            Quiet: true,
          },
        })
        await r2Client.send(deleteCommand)
      }

      res.json({
        success: true,
        message: `文件夹移动成功，共移动 ${movedCount} 个对象`,
        moved: movedCount,
      })
    } else {
      // 单文件移动
      // 冲突检测
      if (!overwrite) {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: targetBucket,
            Key: destinationKey,
          })
          await r2Client.send(headCommand)
          // 目标已存在，返回冲突错误
          return res.status(409).json({
            error: '目标路径已存在',
            conflictKey: destinationKey,
          })
        } catch (headError) {
          // 目标不存在，可以继续移动
          if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
            throw headError
          }
        }
      }

      // 复制
      const copyCommand = new CopyObjectCommand({
        Bucket: targetBucket,
        CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
        Key: destinationKey,
      })
      await r2Client.send(copyCommand)

      // 删除源
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: sourceKey,
      })
      await r2Client.send(deleteCommand)

      res.json({
        success: true,
        message: '文件移动成功',
        moved: 1,
        key: destinationKey,
        bucket: targetBucket,
      })
    }
  } catch (error) {
    console.error('移动对象失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 批量获取下载 URL
app.post('/api/buckets/:bucketName/objects/batch-urls', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.params
  const { keys } = req.body // keys 是要获取 URL 的对象 key 数组

  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return res.status(400).json({ error: '请提供要获取 URL 的对象列表' })
  }

  try {
    const results = []

    for (const key of keys) {
      try {
        const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
        const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 })
        results.push({ key, url, success: true })
      } catch (error) {
        results.push({ key, error: error.message, success: false })
      }
    }

    res.json({ results })
  } catch (error) {
    console.error('批量获取 URL 失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// ==================== Batch Copy/Move APIs ====================

// SSE 进度报告辅助函数
function sendSSEProgress(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// 批量操作进度报告（统一封装）
function reportBatchProgress(res, isSSERequest, opts) {
  if (!isSSERequest) return
  const { current, total, sourceKey, destKey, stats } = opts
  const { totalCopied, totalMoved, totalSkipped, totalErrors } = stats
  sendSSEProgress(res, {
    type: 'progress',
    current,
    total,
    currentSourceKey: sourceKey,
    currentDestKey: destKey,
    totalCopied: totalCopied || 0,
    totalMoved: totalMoved || 0,
    totalSkipped: totalSkipped || 0,
    totalErrors: totalErrors || 0,
  })
}

// API: 批量复制对象 (支持 SSE 进度)
app.post('/api/buckets/:bucketName/objects/batch-copy', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.params
  const { items, destinationBucket, overwrite = false } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '请提供要复制的对象列表' })
  }

  // 检测是否请求 SSE
  const isSSERequest = req.headers.accept === 'text/event-stream'

  if (isSSERequest) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
  }

  const targetBucket = destinationBucket || bucketName
  const results = []
  let totalCopied = 0
  let totalSkipped = 0
  let totalErrors = 0
  const totalItems = items.length

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const { sourceKey, destinationKey, isFolder } = item
      let itemCopied = 0
      let itemSkipped = 0
      let itemError = null

      try {
        // 检查是否是文件夹
        if (isFolder || sourceKey.endsWith('/')) {
          // 文件夹复制：递归复制所有子对象
          let allObjects = []
          let continuationToken = undefined

          do {
            const listCommand = new ListObjectsV2Command({
              Bucket: bucketName,
              Prefix: sourceKey,
              ContinuationToken: continuationToken,
              MaxKeys: 1000,
            })
            const listResponse = await r2Client.send(listCommand)

            if (listResponse.Contents) {
              allObjects = allObjects.concat(listResponse.Contents)
            }

            continuationToken = listResponse.NextContinuationToken
          } while (continuationToken)

          if (allObjects.length === 0) {
            // 空文件夹
            if (!overwrite) {
              try {
                const headCommand = new HeadObjectCommand({
                  Bucket: targetBucket,
                  Key: destinationKey,
                })
                await r2Client.send(headCommand)
                results.push({
                  sourceKey,
                  destinationKey,
                  status: 'skipped',
                  skipReason: '目标已存在',
                })
                totalSkipped++
                reportBatchProgress(res, isSSERequest, {
                  current: i + 1,
                  total: totalItems,
                  sourceKey,
                  destKey: destinationKey,
                  stats: { totalCopied, totalSkipped, totalErrors }
                })
                continue
              } catch (headError) {
                if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
                  throw headError
                }
              }
            }

            const copyCommand = new CopyObjectCommand({
              Bucket: targetBucket,
              CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
              Key: destinationKey,
            })
            await r2Client.send(copyCommand)
            results.push({
              sourceKey,
              destinationKey,
              status: 'success',
              copied: 1,
            })
            totalCopied++
            reportBatchProgress(res, isSSERequest, {
              current: i + 1,
              total: totalItems,
              sourceKey,
              destKey: destinationKey,
              stats: { totalCopied, totalSkipped, totalErrors }
            })
            continue
          }

          // 逐个复制子对象
          let copiedCount = 0
          let hasError = false
          let errorMsg = ''

          for (const obj of allObjects) {
            const relativePath = obj.Key.substring(sourceKey.length)
            const targetKey = `${destinationKey}${relativePath}`

            // 冲突检测
            if (!overwrite) {
              try {
                const headCommand = new HeadObjectCommand({
                  Bucket: targetBucket,
                  Key: targetKey,
                })
                await r2Client.send(headCommand)
                hasError = true
                errorMsg = `目标路径已存在: ${targetKey}`
                break
              } catch (headError) {
                if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
                  throw headError
                }
              }
            }

            const copyCommand = new CopyObjectCommand({
              Bucket: targetBucket,
              CopySource: `${bucketName}/${encodeURIComponent(obj.Key)}`,
              Key: targetKey,
            })
            await r2Client.send(copyCommand)
            copiedCount++
          }

          if (hasError) {
            results.push({
              sourceKey,
              destinationKey,
              status: 'error',
              error: errorMsg,
            })
            totalErrors++
          } else {
            results.push({
              sourceKey,
              destinationKey,
              status: 'success',
              copied: copiedCount,
            })
            totalCopied += copiedCount
          }
        } else {
          // 单文件复制
          if (!overwrite) {
            try {
              const headCommand = new HeadObjectCommand({
                Bucket: targetBucket,
                Key: destinationKey,
              })
              await r2Client.send(headCommand)
              results.push({
                sourceKey,
                destinationKey,
                status: 'skipped',
                skipReason: '目标已存在',
              })
              totalSkipped++
              reportBatchProgress(res, isSSERequest, {
                current: i + 1,
                total: totalItems,
                sourceKey,
                destKey: destinationKey,
                stats: { totalCopied, totalSkipped, totalErrors }
              })
              continue
            } catch (headError) {
              if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
                throw headError
              }
            }
          }

          const copyCommand = new CopyObjectCommand({
            Bucket: targetBucket,
            CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
            Key: destinationKey,
          })
          await r2Client.send(copyCommand)

          results.push({
            sourceKey,
            destinationKey,
            status: 'success',
            copied: 1,
          })
          totalCopied++
        }
      } catch (err) {
        results.push({
          sourceKey,
          destinationKey,
          status: 'error',
          error: err.message,
        })
        totalErrors++
      }

      // 循环末尾发送进度
      reportBatchProgress(res, isSSERequest, {
        current: i + 1,
        total: totalItems,
        sourceKey,
        destKey: destinationKey,
        stats: { totalCopied, totalSkipped, totalErrors }
      })
    }

    // 发送完成事件或返回 JSON
    if (isSSERequest) {
      sendSSEProgress(res, {
        type: 'complete',
        success: true,
        message: `批量复制完成: 成功 ${totalCopied}, 跳过 ${totalSkipped}, 失败 ${totalErrors}`,
        results,
        totalCopied,
        totalSkipped,
        totalErrors
      })
      res.end()
    } else {
      res.json({
        success: true,
        message: `批量复制完成: 成功 ${totalCopied}, 跳过 ${totalSkipped}, 失败 ${totalErrors}`,
        results,
        totalCopied,
        totalSkipped,
        totalErrors
      })
    }
  } catch (error) {
    console.error('批量复制失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 批量移动对象 (支持 SSE 进度)
app.post('/api/buckets/:bucketName/objects/batch-move', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName } = req.params
  const { items, destinationBucket, overwrite = false } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '请提供要移动的对象列表' })
  }

  // 检测是否请求 SSE
  const isSSERequest = req.headers.accept === 'text/event-stream'

  if (isSSERequest) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
  }

  const targetBucket = destinationBucket || bucketName
  const totalItems = items.length
  const results = []
  let totalMoved = 0
  let totalSkipped = 0
  let totalErrors = 0

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const { sourceKey, destinationKey, isFolder } = item

      // 自身移动检测
      if (bucketName === targetBucket && sourceKey === destinationKey) {
        results.push({
          sourceKey,
          destinationKey,
          status: 'skipped',
          skipReason: '源路径和目标路径相同',
        })
        totalSkipped++
        reportBatchProgress(res, isSSERequest, {
          current: i + 1,
          total: totalItems,
          sourceKey,
          destKey: destinationKey,
          stats: { totalMoved, totalSkipped, totalErrors }
        })
        continue
      }

      // 文件夹移动到自身子目录检测
      if (bucketName === targetBucket && (isFolder || sourceKey.endsWith('/'))) {
        if (destinationKey.startsWith(sourceKey)) {
          results.push({
            sourceKey,
            destinationKey,
            status: 'skipped',
            skipReason: '不能将文件夹移动到自身或子目录中',
          })
          totalSkipped++
          reportBatchProgress(res, isSSERequest, {
            current: i + 1,
            total: totalItems,
            sourceKey,
            destKey: destinationKey,
            stats: { totalMoved, totalSkipped, totalErrors }
          })
          continue
        }
      }

      try {
        // 检查是否是文件夹
        if (isFolder || sourceKey.endsWith('/')) {
          // 文件夹移动：递归复制后删除源
          let allObjects = []
          let continuationToken = undefined

          do {
            const listCommand = new ListObjectsV2Command({
              Bucket: bucketName,
              Prefix: sourceKey,
              ContinuationToken: continuationToken,
              MaxKeys: 1000,
            })
            const listResponse = await r2Client.send(listCommand)

            if (listResponse.Contents) {
              allObjects = allObjects.concat(listResponse.Contents)
            }

            continuationToken = listResponse.NextContinuationToken
          } while (continuationToken)

          if (allObjects.length === 0) {
            // 空文件夹
            if (!overwrite) {
              try {
                const headCommand = new HeadObjectCommand({
                  Bucket: targetBucket,
                  Key: destinationKey,
                })
                await r2Client.send(headCommand)
                results.push({
                  sourceKey,
                  destinationKey,
                  status: 'skipped',
                  skipReason: '目标已存在',
                })
                totalSkipped++
                reportBatchProgress(res, isSSERequest, {
                  current: i + 1,
                  total: totalItems,
                  sourceKey,
                  destKey: destinationKey,
                  stats: { totalMoved, totalSkipped, totalErrors }
                })
                continue
              } catch (headError) {
                if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
                  throw headError
                }
              }
            }

            const copyCommand = new CopyObjectCommand({
              Bucket: targetBucket,
              CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
              Key: destinationKey,
            })
            await r2Client.send(copyCommand)

            const deleteCommand = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: sourceKey,
            })
            await r2Client.send(deleteCommand)

            results.push({
              sourceKey,
              destinationKey,
              status: 'success',
              moved: 1,
            })
            totalMoved++
            continue
          }

          // 逐个复制子对象
          let movedCount = 0
          const copiedKeys = []
          let hasError = false
          let errorMsg = ''

          for (const obj of allObjects) {
            const relativePath = obj.Key.substring(sourceKey.length)
            const targetObjKey = `${destinationKey}${relativePath}`

            // 冲突检测
            if (!overwrite) {
              try {
                const headCommand = new HeadObjectCommand({
                  Bucket: targetBucket,
                  Key: targetObjKey,
                })
                await r2Client.send(headCommand)
                hasError = true
                errorMsg = `目标路径已存在: ${targetObjKey}`
                break
              } catch (headError) {
                if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
                  throw headError
                }
              }
            }

            const copyCommand = new CopyObjectCommand({
              Bucket: targetBucket,
              CopySource: `${bucketName}/${encodeURIComponent(obj.Key)}`,
              Key: targetObjKey,
            })
            await r2Client.send(copyCommand)
            copiedKeys.push(obj.Key)
            movedCount++
          }

          if (hasError) {
            results.push({
              sourceKey,
              destinationKey,
              status: 'error',
              error: errorMsg,
            })
            totalErrors++
          } else {
            // 批量删除源对象
            for (let i = 0; i < copiedKeys.length; i += 1000) {
              const batch = copiedKeys.slice(i, i + 1000)
              const deleteCommand = new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                  Objects: batch.map((k) => ({ Key: k })),
                  Quiet: true,
                },
              })
              await r2Client.send(deleteCommand)
            }

            results.push({
              sourceKey,
              destinationKey,
              status: 'success',
              moved: movedCount,
            })
            totalMoved += movedCount
          }
        } else {
          // 单文件移动
          if (!overwrite) {
            try {
              const headCommand = new HeadObjectCommand({
                Bucket: targetBucket,
                Key: destinationKey,
              })
              await r2Client.send(headCommand)
              results.push({
                sourceKey,
                destinationKey,
                status: 'skipped',
                skipReason: '目标已存在',
              })
              totalSkipped++
              reportBatchProgress(res, isSSERequest, {
                current: i + 1,
                total: totalItems,
                sourceKey,
                destKey: destinationKey,
                stats: { totalMoved, totalSkipped, totalErrors }
              })
              continue
            } catch (headError) {
              if (headError.name !== 'NotFound' && headError.$metadata?.httpStatusCode !== 404) {
                throw headError
              }
            }
          }

          // 复制
          const copyCommand = new CopyObjectCommand({
            Bucket: targetBucket,
            CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
            Key: destinationKey,
          })
          await r2Client.send(copyCommand)

          // 删除源
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: sourceKey,
          })
          await r2Client.send(deleteCommand)

          results.push({
            sourceKey,
            destinationKey,
            status: 'success',
            moved: 1,
          })
          totalMoved++
        }
      } catch (err) {
        results.push({
          sourceKey,
          destinationKey,
          status: 'error',
          error: err.message,
        })
        totalErrors++
      }

      reportBatchProgress(res, isSSERequest, {
        current: i + 1,
        total: totalItems,
        sourceKey,
        destKey: destinationKey,
        stats: { totalMoved, totalSkipped, totalErrors }
      })
    }

    // 发送完成事件或返回 JSON
    if (isSSERequest) {
      sendSSEProgress(res, {
        type: 'complete',
        success: true,
        message: `批量移动完成: 成功 ${totalMoved}, 跳过 ${totalSkipped}, 失败 ${totalErrors}`,
        results,
        totalMoved,
        totalSkipped,
        totalErrors
      })
      res.end()
    } else {
      res.json({
        success: true,
        message: `批量移动完成: 成功 ${totalMoved}, 跳过 ${totalSkipped}, 失败 ${totalErrors}`,
        results,
        totalMoved,
        totalSkipped,
        totalErrors
      })
    }
  } catch (error) {
    console.error('批量移动失败:', error)
    if (isSSERequest) {
      sendSSEProgress(res, {
        type: 'error',
        error: error.message
      })
      res.end()
    } else {
      res.status(500).json({ error: error.message })
    }
  }
})

// ==================== Multipart Upload APIs ====================

// API: 初始化分块上传
app.post('/api/buckets/:bucketName/objects/:key(*)/multipart/initiate', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params
  const { contentType } = req.body

  try {
    console.log('[Multipart] Initiating upload:', { bucketName, key, contentType })

    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    })

    const response = await r2Client.send(command)
    console.log('[Multipart] Initiated:', { key, uploadId: response.UploadId })

    res.json({
      uploadId: response.UploadId,
      key,
    })
  } catch (error) {
    console.error('[Multipart] Initiate failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 上传分块
app.post('/api/buckets/:bucketName/objects/:key(*)/multipart/upload-part', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params
  const uploadId = req.headers['x-upload-id']
  const partNumber = parseInt(req.headers['x-part-number'] || '1', 10)
  const contentLength = parseInt(req.headers['content-length'] || '0', 10)

  if (!uploadId) {
    return res.status(400).json({ error: '缺少 X-Upload-Id 请求头' })
  }

  try {
    console.log('[Multipart] Uploading part:', {
      key,
      uploadId,
      partNumber,
      contentLength,
    })

    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: req, // 流式传输请求体
      ContentLength: contentLength,
    })

    const response = await r2Client.send(command)
    console.log('[Multipart] Part uploaded:', { key, partNumber, etag: response.ETag })

    res.json({
      partNumber,
      etag: response.ETag,
    })
  } catch (error) {
    console.error('[Multipart] Upload part failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 完成分块上传
app.post('/api/buckets/:bucketName/objects/:key(*)/multipart/complete', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params
  const { uploadId, parts } = req.body

  if (!uploadId || !parts || !Array.isArray(parts)) {
    return res.status(400).json({ error: '缺少 uploadId 或 parts' })
  }

  try {
    console.log('[Multipart] Completing upload:', {
      key,
      uploadId,
      partsCount: parts.length,
    })

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          PartNumber: p.PartNumber,
          ETag: p.ETag,
        })),
      },
    })

    const response = await r2Client.send(command)
    console.log('[Multipart] Completed:', { key, location: response.Location })

    res.json({
      location: response.Location,
      key: response.Key,
      etag: response.ETag,
    })
  } catch (error) {
    console.error('[Multipart] Complete failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 取消分块上传
app.post('/api/buckets/:bucketName/objects/:key(*)/multipart/abort', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params
  const { uploadId } = req.body

  if (!uploadId) {
    return res.status(400).json({ error: '缺少 uploadId' })
  }

  try {
    console.log('[Multipart] Aborting upload:', { key, uploadId })

    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
    })

    await r2Client.send(command)
    console.log('[Multipart] Aborted:', { key, uploadId })

    res.json({ success: true })
  } catch (error) {
    console.error('[Multipart] Abort failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// API: 查询已上传的分块（用于暂停/恢复）
app.get('/api/buckets/:bucketName/objects/:key(*)/multipart/parts', async (req, res) => {
  if (!r2Client) {
    return res.status(400).json({ error: '请先配置凭证' })
  }

  const { bucketName, key } = req.params
  const { uploadId } = req.query

  if (!uploadId) {
    return res.status(400).json({ error: '缺少 uploadId 参数' })
  }

  try {
    console.log('[Multipart] Listing parts:', { key, uploadId })

    const command = new ListPartsCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
    })

    const response = await r2Client.send(command)
    console.log('[Multipart] Parts listed:', { key, uploadId, count: response.Parts?.length || 0 })

    // 返回已上传的分块信息
    const parts = (response.Parts || []).map((part) => ({
      PartNumber: part.PartNumber,
      ETag: part.ETag,
      Size: part.Size,
      LastModified: part.LastModified?.toISOString(),
    }))

    res.json({
      uploadId,
      parts,
      isExpired: false,
    })
  } catch (error) {
    console.error('[Multipart] List parts failed:', error)

    // 检查是否是会话过期错误（NoSuchUpload）
    if (error.name === 'NoSuchUpload' || error.Code === 'NoSuchUpload' || error.$metadata?.httpStatusCode === 404) {
      res.json({
        uploadId,
        parts: [],
        isExpired: true,
        error: '上传会话已过期，请重新上传',
      })
    } else {
      res.status(500).json({ error: error.message })
    }
  }
})

// API: 重启服务器
app.post('/api/system/restart', async (req, res) => {
  res.json({ success: true, message: '服务器正在重启...' })

  // 延迟重启，确保响应已发送
  setTimeout(() => {
    console.log('正在重启服务器...')

    // 启动新进程
    const child = spawn(process.argv[0], [process.argv[1]], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'inherit',
      shell: false,
    })

    // 让子进程独立运行
    child.unref()

    // 退出当前进程
    process.exit(0)
  }, 500)
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`R2 Proxy Server running on http://localhost:${PORT}`)
})
