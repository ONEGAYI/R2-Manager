#!/usr/bin/env node

/**
 * 版本号更新脚本
 * 用法: node bump-version.js <version>
 * 示例: node bump-version.js 0.9.4
 */

// 强制使用 CommonJS 模块
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;

// 需要更新版本号的文件配置
const FILES = [
  {
    path: 'package.json',
    type: 'json',
    pattern: /"version":\s*"[^"]+"/,
    replacement: (ver) => `"version": "${ver}"`,
  },
  {
    path: 'server/package.json',
    type: 'json',
    pattern: /"version":\s*"[^"]+"/,
    replacement: (ver) => `"version": "${ver}"`,
  },
  {
    path: 'src-tauri/Cargo.toml',
    type: 'toml',
    pattern: /^version\s*=\s*"[^"]+"/m,
    replacement: (ver) => `version = "${ver}"`,
  },
  {
    path: 'src-tauri/tauri.conf.json',
    type: 'json',
    pattern: /"version":\s*"[^"]+"/,
    replacement: (ver) => `"version": "${ver}"`,
  },
];

function get_current_version(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(pattern);
  if (!match) return null;
  // 提取版本号
  const verMatch = match[0].match(/(\d+\.\d+\.\d+)/);
  return verMatch ? verMatch[1] : null;
}

function update_version(filePath, pattern, replacement, newVersion) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = content.replace(pattern, replacement(newVersion));
  fs.writeFileSync(filePath, newContent, 'utf-8');
}

function validate_version(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log('版本号更新脚本');
    console.log('');
    console.log('用法: node bump-version.js <version>');
    console.log('示例: node bump-version.js 0.9.4');
    console.log('');
    console.log('会更新以下文件的版本号:');
    FILES.forEach(f => console.log(`  - ${f.path}`));
    process.exit(0);
  }

  const newVersion = args[0];

  if (!validate_version(newVersion)) {
    console.error(`错误: 无效的版本号格式 "${newVersion}"`);
    console.error('版本号格式应为: X.Y.Z (如 0.9.4)');
    process.exit(1);
  }

  console.log(`\n正在更新版本号到 ${newVersion}...\n`);

  let allSuccess = true;

  FILES.forEach(file => {
    const filePath = path.join(ROOT_DIR, file.path);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ ${file.path} - 文件不存在，跳过`);
      return;
    }

    const oldVersion = get_current_version(filePath, file.pattern);

    if (!oldVersion) {
      console.log(`  ⚠ ${file.path} - 无法获取当前版本号`);
      allSuccess = false;
      return;
    }

    update_version(filePath, file.pattern, file.replacement, newVersion);
    console.log(`  ✓ ${file.path}: ${oldVersion} → ${newVersion}`);
  });

  console.log('');

  if (allSuccess) {
    console.log('所有版本号已更新完成！');
    console.log(`\n下一步: 更新 CHANGELOG.md 添加 [${newVersion}] 版本记录`);
  } else {
    console.log('部分文件更新失败，请检查');
    process.exit(1);
  }
}

main();
