# Railway 免费部署后端教程

## 快速部署步骤（5分钟）

### 1. 准备工作
- 访问 https://railway.app
- 使用 GitHub 账号登录

### 2. 创建项目
1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择你的 xiaohei-video-station 仓库

### 3. 配置部署
Railway 会自动检测到 Python 项目，但需要添加配置：

#### 创建 Procfile
在项目根目录创建文件 `Procfile`（无扩展名）：
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### 创建 runtime.txt
```
python-3.11
```

#### 创建 requirements.txt
```
fastapi
uvicorn[standard]
requests
beautifulsoup4
```

### 4. 推送代码到 GitHub
```bash
git add .
git commit -m "Add Railway deployment config"
git push
```

### 5. Railway 自动部署
- Railway 检测到新提交会自动部署
- 等待 2-3 分钟构建完成
- 点击 "Settings" → "Generate Domain" 获取公开URL

### 6. 复制 API 地址
例如：`https://xiaohei-video-production.up.railway.app`

### 7. 在 Vercel 设置环境变量
```
NEXT_PUBLIC_API_URL = https://你的Railway域名
```

### 8. Vercel 重新部署
完成！

## Railway 免费额度
- 每月 500 小时运行时间
- 500 MB RAM
- 1 GB 存储空间
- 足够个人学习使用

## 注意事项
- Railway 免费版有休眠机制（30分钟无请求会休眠）
- 首次访问可能需要10-15秒唤醒
- 适合学习测试，不适合生产环境
