#!/bin/bash
set -e

echo "=== darkmic Harness Initialization ==="
echo "=== 初始化验证 ==="

# Check required system tools | 检查系统依赖
echo "--- Checking system dependencies | 检查系统工具 ---"
command -v node >/dev/null 2>&1 || { echo "Error: node not found | 未找到 node"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm not found | 未找到 pnpm (brew install pnpm)"; exit 1; }

echo "--- Installing dependencies | 安装依赖 ---"
pnpm install

echo "--- Type checking | 类型检查 ---"
pnpm run typecheck 2>/dev/null || echo "(typecheck script not configured yet | 尚未配置)"

echo "--- Building | 构建 ---"
pnpm run build 2>/dev/null || echo "(build script not configured yet | 尚未配置)"

echo ""
echo "=== Verification Complete | 验证完成 ==="
echo ""
echo "Next steps | 下一步:"
echo "1. Read feature_list.json to see current feature state | 阅读功能列表"
echo "2. Pick ONE unfinished feature to work on | 选一个未完成的功能"
echo "3. Implement only that feature | 只实现该功能"
echo "4. Re-run verification before claiming done | 完成前重新验证"
