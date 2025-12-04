# GCP Cloud Run 部署指南

本文档说明如何配置 GitHub Actions 自动部署到 GCP Cloud Run。

## 前置要求

1. GCP 项目已创建
2. 已启用以下 API：
   - Cloud Run API
   - Artifact Registry API（或 Container Registry API）
   - Cloud Build API（可选，用于构建）

## 配置步骤

### 1. 创建服务账号并获取密钥

```bash
# 创建服务账号
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Service Account"

# 授予必要权限
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# 创建密钥文件
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 2. 配置 GitHub Secrets

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加以下 secrets：

**必需：**
- `GCP_PROJECT_ID`: 你的 GCP 项目 ID
- `GCP_SA_KEY`: 服务账号密钥文件的内容（整个 JSON 文件内容）

**可选：**
- `GCP_ARTIFACT_REPO`: Artifact Registry 仓库名称（如 `chatbot-poc-youth`），留空则使用 GCR
- `GEMINI_API_KEY_SECRET_NAME`: GCP Secret Manager 中的 secret 名称（用于 Gemini API Key）
- `POSTGRES_URL_SECRET_NAME`: GCP Secret Manager 中的 secret 名称（用于 PostgreSQL 连接字符串）
- `FLASK_SECRET_KEY_SECRET_NAME`: GCP Secret Manager 中的 secret 名称（用于 Flask session 密钥）

### 3. 配置 Secret Manager（可选但推荐）

在 GCP Secret Manager 中创建以下 secrets：

```bash
# 创建 secrets
echo -n "your-gemini-api-key" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "your-postgres-url" | gcloud secrets create POSTGRES_URL --data-file=-
echo -n "your-flask-secret-key" | gcloud secrets create FLASK_SECRET_KEY --data-file=-

# 授予服务账号访问权限
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
    --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 4. 创建 Artifact Registry 仓库（推荐）

```bash
# 创建 Docker 仓库
gcloud artifacts repositories create chatbot-poc-youth \
    --repository-format=docker \
    --location=asia-east1 \
    --description="Docker repository for chatbot-poc-youth"
```

### 5. 自定义部署配置

编辑 `.github/workflows/deploy-cloud-run.yml`，根据需要修改：

- `SERVICE_NAME`: Cloud Run 服务名称（默认：`chatbot-poc-youth`）
- `REGION`: 部署区域（默认：`asia-east1`）
- `memory`: 内存配置（默认：`1Gi`）
- `cpu`: CPU 配置（默认：`1`）
- `min-instances`: 最小实例数（默认：`0`，冷启动）
- `max-instances`: 最大实例数（默认：`10`）

### 6. 环境变量配置

在 Cloud Run 服务中配置环境变量，或通过 Secret Manager 注入：

**必需的环境变量：**
- `GEMINI_API_KEY`: Gemini API 密钥
- `POSTGRES_URL` 或 `POSTGRES_URL_NON_POOLING`: PostgreSQL 连接字符串
- `FLASK_SECRET_KEY`: Flask session 密钥

**可选的环境变量：**
- `FRONTEND_ORIGIN`: 前端域名（CORS 配置）
- `SYSTEM_PROMPT`: 自定义系统提示词
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth 配置
- `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`: LINE OAuth 配置
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`: Facebook OAuth 配置

### 7. 触发部署

部署会在以下情况自动触发：
- 推送到 `main` 或 `master` 分支
- 手动触发（Actions → Deploy to Cloud Run → Run workflow）

## 本地测试 Docker 镜像

```bash
# 构建镜像
docker build -t chatbot-poc-youth:local .

# 运行容器
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e GEMINI_API_KEY=your-key \
  -e POSTGRES_URL=your-postgres-url \
  chatbot-poc-youth:local
```

## 故障排除

### 构建失败

1. 检查 Dockerfile 是否正确
2. 确认所有依赖文件都已包含
3. 查看 GitHub Actions 日志

### 部署失败

1. 检查 GCP 服务账号权限
2. 确认 Artifact Registry 仓库已创建
3. 验证环境变量和 secrets 配置

### 运行时错误

1. 检查 Cloud Run 日志：`gcloud run services logs read chatbot-poc-youth --region=asia-east1`
2. 确认环境变量已正确设置
3. 验证数据库连接

## 注意事项

1. **数据库**: 生产环境建议使用 Cloud SQL PostgreSQL，而不是 SQLite
2. **文件存储**: `uploads/` 目录在 Cloud Run 中是临时的，建议使用 Cloud Storage
3. **Session**: 生产环境应使用 Redis 或数据库存储 session
4. **成本优化**: 设置 `min-instances=0` 可以降低成本，但会有冷启动延迟

## 相关资源

- [Cloud Run 文档](https://cloud.google.com/run/docs)
- [Artifact Registry 文档](https://cloud.google.com/artifact-registry/docs)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

