# Railway 部署配置

此文件告诉 Railway 忽略前端文件，只部署 Python 后端。

## 忽略的文件：
- Next.js 前端代码（src/, public/, .next/）
- Node.js 依赖（node_modules/, package.json）
- 静态 HTML 文件

## 保留的文件：
- Python 后端代码（main.py）
- Python 依赖（requirements.txt）
- 部署配置（Procfile, runtime.txt, nixpacks.toml）
