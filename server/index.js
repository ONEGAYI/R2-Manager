import express from 'express'
import cors from 'cors'
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const app = express()
app.use(cors())
app.use(express.json())

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

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`R2 Proxy Server running on http://localhost:${PORT}`)
})
