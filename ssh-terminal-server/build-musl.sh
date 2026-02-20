#!/bin/bash
# 使用 muslrust 构建静态链接的二进制文件
# 适用于 CentOS 7、Debian、Ubuntu 等 Linux 发行版

set -e

IMAGE_NAME="registry.cn-hangzhou.aliyuncs.com/pull-image/muslrust:latest"
CONTAINER_NAME="ssh-terminal-builder"
PROJECT_DIR="$(pwd)"
OUTPUT_DIR="${PROJECT_DIR}/target/x86_64-unknown-linux-musl/release"
BUILD_ENV="${1:-production}"

echo "========================================="
echo "  SSH Terminal Server - Musl Build Script"
echo "========================================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

# ==============================================================================
# 安全提示：构建阶段不需要真实密码！
# ==============================================================================
# 编译阶段只检查代码语法和类型，不连接数据库。
# 请在部署时通过环境变量注入真实配置，不要在配置文件中存储敏感信息。
# ==============================================================================

# 使用占位符配置进行构建（编译阶段不需要真实连接）
DATABASE_URL="sqlite:///tmp/build_placeholder.db"
REDIS_URL="redis://localhost:6379"

echo "构建环境: ${BUILD_ENV}"
echo "⚠️  构建阶段使用占位符配置（不连接真实数据库）"
echo "  数据库: ${DATABASE_URL}"
echo "  Redis: ${REDIS_URL}"
echo ""

echo "拉取 ${IMAGE_NAME} 镜像..."
docker pull ${IMAGE_NAME}

echo ""
echo "开始构建..."
echo "项目目录: ${PROJECT_DIR}"
echo ""

# 创建一个临时的容器来构建项目
docker run --rm \
    -v "${PROJECT_DIR}:/volume:z" \
    -w /volume \
    -e CARGO_TARGET_DIR=/volume/target \
    -e DATABASE_URL="${DATABASE_URL}" \
    -e REDIS_URL="${REDIS_URL}" \
    -e APP_ENV="${BUILD_ENV}" \
    --network host \
    ${IMAGE_NAME} \
    cargo build --release

echo ""
echo "========================================="
echo "  构建完成!"
echo "========================================="
echo ""

# 二进制文件名
BINARY_NAME="ssh-terminal-server"
if [ -f "${OUTPUT_DIR}/${BINARY_NAME}" ]; then
    echo "✓ 二进制文件已生成"
    echo ""
    echo "文件信息:"
    ls -lh "${OUTPUT_DIR}/${BINARY_NAME}"
    echo ""
    echo "依赖检查:"
    ldd "${OUTPUT_DIR}/${BINARY_NAME}" 2>&1 | head -1 || echo "✓ 静态链接成功 (not a dynamic executable)"
    echo ""
    echo "文件类型:"
    file "${OUTPUT_DIR}/${BINARY_NAME}"
    echo ""
    echo "可以使用以下命令运行:"
    echo "  ./${OUTPUT_DIR}/${BINARY_NAME} -e ${BUILD_ENV}"
    echo ""
    echo "或使用配置文件运行:"
    echo "  ./${OUTPUT_DIR}/${BINARY_NAME} -c config/${BUILD_ENV}.toml"
    echo ""
    echo "========================================="
    echo "  部署配置指南"
    echo "========================================="
    echo ""
    echo "⚠️  重要：部署时请通过环境变量注入真实配置"
    echo ""
    echo "方式一：使用环境变量（推荐）"
    echo "  export DATABASE_TYPE=postgresql"
    echo "  export DATABASE_HOST=localhost"
    echo "  export DATABASE_PORT=5432"
    echo "  export DATABASE_USER=your_user"
    echo "  export DATABASE_PASSWORD=your_password"
    echo "  export DATABASE_DATABASE=ssh_terminal_server"
    echo "  export REDIS_HOST=localhost"
    echo "  export REDIS_PORT=6379"
    echo "  export REDIS_PASSWORD=your_redis_password"
    echo "  export JWT_SECRET=your_jwt_secret"
    echo "  ./${OUTPUT_DIR}/${BINARY_NAME}"
    echo ""
    echo "方式二：使用配置文件"
    echo "  cp config/production.toml.example config/production.toml"
    echo "  # 编辑 config/production.toml，填入真实配置"
    echo "  ./${OUTPUT_DIR}/${BINARY_NAME} -c config/production.toml"
    echo ""
    echo "🔒 安全提示："
    echo "  - 不要将包含真实密码的配置文件提交到 Git 仓库"
    echo "  - 使用 .gitignore 排除配置文件：config/production.toml"
    echo "  - 生产环境务必修改 JWT_SECRET 为强随机字符串"
    echo ""
    echo "========================================="
    echo "  构建 Docker 镜像"
    echo "========================================="
    echo ""

    # 创建 Dockerfile
    DOCKERFILE_PATH="${PROJECT_DIR}/Dockerfile"
    echo "创建 Dockerfile..."

    cat > "${DOCKERFILE_PATH}" <<'EOF'
# 使用 scratch 基础镜像（最小化，仅包含二进制文件）
FROM scratch

# 复制静态链接的二进制文件
COPY ssh-terminal-server /ssh-terminal-server

# 暴露端口
EXPOSE 3000

# 设置工作目录
WORKDIR /

# 设置环境变量（默认值，可被 docker run -e 覆盖）
ENV DATABASE_TYPE=postgresql \
    DATABASE_HOST=localhost \
    DATABASE_PORT=5432 \
    DATABASE_USER=postgres \
    DATABASE_PASSWORD=changeme \
    DATABASE_DATABASE=ssh_terminal_server \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    REDIS_PASSWORD=changeme \
    JWT_SECRET=changeme_please_modify_in_production \
    APP_ENV=production \
    RUST_LOG=info

# 运行二进制文件
ENTRYPOINT ["/ssh-terminal-server"]
CMD ["-e", "production"]
EOF

    echo "✓ Dockerfile 已创建"
    echo ""

    # 临时复制二进制文件到项目根目录
    echo "准备镜像构建..."
    cp "${OUTPUT_DIR}/${BINARY_NAME}" "${PROJECT_DIR}/${BINARY_NAME}"

    # 构建镜像
    IMAGE_TAG="ssh-terminal-server:latest"
    echo "构建 Docker 镜像: ${IMAGE_TAG}"
    docker build -t "${IMAGE_TAG}" -f "${DOCKERFILE_PATH}" "${PROJECT_DIR}"

    # 清理临时文件
    rm "${PROJECT_DIR}/${BINARY_NAME}"

    echo ""
    echo "========================================="
    echo "  镜像构建完成!"
    echo "========================================="
    echo ""

    # 显示镜像信息
    echo "镜像信息:"
    docker images "${IMAGE_TAG}"
    echo ""

    echo "========================================="
    echo "  使用说明"
    echo "========================================="
    echo ""
    echo "运行容器（使用环境变量配置）："
    echo ""
    echo "  docker run -d \\"
    echo "    --name ssh-terminal \\"
    echo "    -p 3000:3000 \\"
    echo "    -e DATABASE_TYPE=postgresql \\"
    echo "    -e DATABASE_HOST=your_db_host \\"
    echo "    -e DATABASE_PORT=5432 \\"
    echo "    -e DATABASE_USER=your_db_user \\"
    echo "    -e DATABASE_PASSWORD=your_db_password \\"
    echo "    -e DATABASE_DATABASE=ssh_terminal_server \\"
    echo "    -e REDIS_HOST=your_redis_host \\"
    echo "    -e REDIS_PORT=6379 \\"
    echo "    -e REDIS_PASSWORD=your_redis_password \\"
    echo "    -e JWT_SECRET=your_jwt_secret \\"
    echo "    ssh-terminal-server:latest"
    echo ""
    echo "使用 SQLite 数据库（最简单）："
    echo ""
    echo "  docker run -d \\"
    echo "    --name ssh-terminal \\"
    echo "    -p 3000:3000 \\"
    echo "    -e DATABASE_TYPE=sqlite \\"
    echo "    -e DATABASE_PATH=/data/app.db \\"
    echo "    -v /path/to/data:/data \\"
    echo "    ssh-terminal-server:latest"
    echo ""
    echo "查看日志："
    echo "  docker logs -f ssh-terminal"
    echo ""
    echo "停止容器："
    echo "  docker stop ssh-terminal"
    echo ""
    echo "删除容器："
    echo "  docker rm ssh-terminal"
    echo ""
    echo "📦 导出镜像为 tar 文件："
    echo "  docker save -o ssh-terminal-server.tar ssh-terminal-server:latest"
    echo ""
    echo "📦 在其他机器上导入镜像："
    echo "  docker load -i ssh-terminal-server.tar"
    echo ""
else
    echo "✗ 构建失败: 未找到二进制文件"
    exit 1
fi