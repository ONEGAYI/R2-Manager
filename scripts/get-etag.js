/**
 * 获取 R2 对象的 ETag 信息
 *
 * 使用方法:
 *   1. 填写 etag.config.json 中的配置信息
 *   2. node scripts/get-etag.js
 */

const path = require('path')
const fs = require('fs')
const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')

// 加载配置
const configPath = path.join(__dirname, 'etag.config.json')
let config

try {
  const content = fs.readFileSync(configPath, 'utf-8')
  config = JSON.parse(content)
} catch (err) {
  console.error('❌ 无法读取配置文件 scripts/etag.config.json')
  console.error('   请先创建并填写配置文件')
  process.exit(1)
}

// 验证必要字段
const required = ['accountId', 'accessKeyId', 'secretAccessKey', 'bucket']
const missing = required.filter(key => !config[key])

if (missing.length > 0) {
  console.error(`❌ 配置文件缺少必要字段: ${missing.join(', ')}`)
  process.exit(1)
}

// 创建 S3 客户端
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

/**
 * 获取单个对象的 ETag
 */
async function getObjectETag(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })

    const response = await client.send(command)

    console.log('\n📄 对象信息:')
    console.log('─'.repeat(50))
    console.log(`  Key:        ${key}`)
    console.log(`  ETag:       ${response.ETag}`)
    console.log(`  Size:       ${formatSize(response.ContentLength)}`)
    console.log(`  LastModified: ${response.LastModified?.toISOString()}`)
    console.log(`  ContentType:  ${response.ContentType}`)

    return response
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.error(`❌ 对象不存在: ${key}`)
    } else {
      console.error(`❌ 获取对象失败: ${err.message}`)
    }
    return null
  }
}

/**
 * 列出桶内对象及其 ETag
 */
async function listObjectsWithETag(prefix = '', maxKeys = 10) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    })

    const response = await client.send(command)

    if (!response.Contents || response.Contents.length === 0) {
      console.log('📭 桶内没有对象')
      return
    }

    console.log(`\n📋 桶内对象列表 (共 ${response.KeyCount} 个，显示前 ${response.Contents.length} 个):`)
    console.log('─'.repeat(80))
    console.log('  ETag                          | Size       | Key')
    console.log('─'.repeat(80))

    for (const obj of response.Contents) {
      const etag = obj.ETag?.padEnd(30) || 'N/A'
      const size = formatSize(obj.Size).padStart(10)
      console.log(`  ${etag} | ${size} | ${obj.Key}`)
    }

    if (response.IsTruncated) {
      console.log('\n  ... 还有更多对象')
    }

    return response.Contents
  } catch (err) {
    console.error(`❌ 列出对象失败: ${err.message}`)
    return null
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 R2 ETag 查询工具')
  console.log('═'.repeat(50))
  console.log(`  Endpoint: https://${config.accountId}.r2.cloudflarestorage.com`)
  console.log(`  Bucket:   ${config.bucket}`)

  // 如果配置了具体的 key，获取该对象的 ETag
  if (config.key) {
    await getObjectETag(config.key)
  } else {
    // 否则列出桶内对象
    await listObjectsWithETag(config.prefix || '', config.maxKeys || 20)
  }

  console.log('\n✅ 完成')
}

main().catch(err => {
  console.error('❌ 执行失败:', err.message)
  process.exit(1)
})
