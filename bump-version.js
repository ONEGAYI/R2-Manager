#!/usr/bin/env node

/**
 * 版本号更新脚本
 *
 * 用法: node bump-version.js <version|patch|minor|major>
 * 示例:
 *   node bump-version.js patch   # 0.9.10 → 0.9.11
 *   node bump-version.js minor   # 0.9.10 → 0.10.0
 *   node bump-version.js major   # 0.9.10 → 1.0.0
 *   node bump-version.js 0.9.11  # 直接指定版本号
 */

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

/**
 * 从 package.json 获取当前版本号
 */
function get_current_version() {
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('错误: package.json 不存在');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/**
 * 解析版本号字符串为数字数组
 */
function parse_version(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  return parts;
}

/**
 * 将版本号数组转为字符串
 */
function format_version(parts) {
  return parts.join('.');
}

/**
 * 验证版本号格式
 */
function validate_version(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * 计算 bump 后的版本号
 * @param {string} currentVersion - 当前版本号 (如 "0.9.10")
 * @param {string} bumpType - bump 类型 (patch/minor/major)
 * @returns {string} 新版本号
 */
function bump_version(currentVersion, bumpType) {
  const parts = parse_version(currentVersion);
  if (!parts) {
    console.error(`错误: 无法解析当前版本号 "${currentVersion}"`);
    process.exit(1);
  }

  const [major, minor, patch] = parts;

  switch (bumpType.toLowerCase()) {
    case 'patch':
      return format_version([major, minor, patch + 1]);
    case 'minor':
      return format_version([major, minor + 1, 0]);
    case 'major':
      return format_version([major + 1, 0, 0]);
    default:
      console.error(`错误: 未知的 bump 类型 "${bumpType}"`);
      console.error('支持的类型: patch, minor, major');
      process.exit(1);
  }
}

/**
 * 从文件中提取版本号
 */
function extract_version(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(pattern);
  if (!match) return null;
  const verMatch = match[0].match(/(\d+\.\d+\.\d+)/);
  return verMatch ? verMatch[1] : null;
}

/**
 * 更新文件中的版本号
 */
function update_version(filePath, pattern, replacement, newVersion) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = content.replace(pattern, replacement(newVersion));
  fs.writeFileSync(filePath, newContent, 'utf-8');
}

function print_help() {
  console.log('版本号更新脚本');
  console.log('');
  console.log('用法: node bump-version.js <version|patch|minor|major>');
  console.log('');
  console.log('参数:');
  console.log('  patch     Bug 修复版本 (+0.0.1)');
  console.log('  minor     功能更新版本 (+0.1.0, patch 归零)');
  console.log('  major     重大更新版本 (+1.0.0, minor 和 patch 归零)');
  console.log('  X.Y.Z     直接指定版本号');
  console.log('');
  console.log('示例:');
  console.log('  node bump-version.js patch   # 0.9.10 → 0.9.11');
  console.log('  node bump-version.js minor   # 0.9.10 → 0.10.0');
  console.log('  node bump-version.js major   # 0.9.10 → 1.0.0');
  console.log('  node bump-version.js 1.2.3   # 直接设置为 1.2.3');
  console.log('');
  console.log('会更新以下文件的版本号:');
  FILES.forEach(f => console.log(`  - ${f.path}`));
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    print_help();
    process.exit(0);
  }

  const input = args[0];
  const currentVersion = get_current_version();
  let newVersion;

  // 判断是 bump 类型还是直接版本号
  if (['patch', 'minor', 'major'].includes(input.toLowerCase())) {
    newVersion = bump_version(currentVersion, input);
    console.log(`\n Bump ${input}: ${currentVersion} → ${newVersion}\n`);
  } else if (validate_version(input)) {
    newVersion = input;
    console.log(`\n设置版本号: ${currentVersion} → ${newVersion}\n`);
  } else {
    console.error(`错误: 无效的参数 "${input}"`);
    console.error('请使用 patch/minor/major 或完整版本号 (如 0.9.11)');
    process.exit(1);
  }

  // 检查版本号是否有效（不能低于当前版本）
  const currentParts = parse_version(currentVersion);
  const newParts = parse_version(newVersion);
  const currentNum = currentParts[0] * 10000 + currentParts[1] * 100 + currentParts[2];
  const newNum = newParts[0] * 10000 + newParts[1] * 100 + newParts[2];

  if (newNum <= currentNum && input !== 'major') {
    // 对于手动指定版本号，允许降级（可能用于测试）
    if (validate_version(input)) {
      console.log('  ⚠ 警告: 新版本号不高于当前版本号');
    }
  }

  let allSuccess = true;

  FILES.forEach(file => {
    const filePath = path.join(ROOT_DIR, file.path);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ ${file.path} - 文件不存在，跳过`);
      return;
    }

    const oldVersion = extract_version(filePath, file.pattern);

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
    console.log('✅ 所有版本号已更新完成！');
    console.log(`\n下一步: 更新 CHANGELOG.md 添加 [${newVersion}] 版本记录`);
  } else {
    console.log('⚠️ 部分文件更新失败，请检查');
    process.exit(1);
  }
}

main();
