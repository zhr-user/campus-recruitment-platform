# 校招罗盘 · 校招信息聚合与智能推荐平台

平台已接入真实邮箱账号的注册、登录、退出和独立求职空间。界面采用白灰雾化背景、半透明白色面板，鼠标移动会产生沿移动方向扩散的柔和波纹。

## 启动

在项目根目录双击 **启动平台.cmd**。首次运行会创建 backend/.venv 并安装依赖，需要网络及 Python 3.11 或更新版本；此电脑也会自动识别已安装的 Codex Python 运行环境。后续启动无需重新安装。

浏览器访问 **http://127.0.0.1:8791/**。保留启动窗口，关闭窗口或按 Ctrl+C 停止服务。请优先通过此地址使用平台；直接双击 frontend/index.html 也能打开，但会进入离线演示模式（见下）。

## 离线演示模式（直接双击 index.html）

不启动服务时，直接双击 frontend/index.html，页面会改用浏览器本地存储模拟账号与数据保存：

- 注册、登录、退出、画像、推荐、投递看板、洞察与算法实验都可正常使用，操作方式与通过服务打开时一致。
- 账号、密码摘要和求职数据只保存在这台电脑的这个浏览器里；清理浏览器站点数据会一并删除，也不会同步到其他设备或其他浏览器。
- 离线账号与通过服务打开的账号互不通用：在离线模式注册的邮箱，需要重新在服务端注册一次。
- 离线模式没有管理员后台，也没有跨设备同步；需要真实账号服务、后台权限或多人分别登录时，仍然双击 **启动平台.cmd**。
- 页面顶部的保存状态会显示「已存到本机」，登录页与账号面板也会标注离线演示模式。

首次使用点击「注册」，填写昵称、邮箱和12至128位密码。没有预置账号、默认密码或自选管理员身份。新账号的技能、收藏和投递记录为空；画像模板需要主动选择并保存。

## 已实现功能

- 真实注册登录、错误与重复邮箱校验、显示或隐藏密码、可选保持登录30天。
- 服务端保存账号；密码采用随机盐 scrypt 哈希；登录使用 HttpOnly、SameSite=Strict 的可撤销会话 Cookie。
- 画像、收藏、投递状态、备注、时间线和偏好按账号保存；退出时清空页面中的个人数据，重新登录可以恢复。
- 保存状态提示、网络失败重试、版本冲突保护；窗口切换账号后拦截旧页面提交。
- 求职画像与预设、规则与 TF-IDF 推荐、招聘洞察、离线算法比较、个人投递记录导出。
- 后台由服务端校验管理员权限，提供历史岗位查询、词典查询与导出、样本质量统计。
- 白灰雾化背景与方向波纹；触屏和「减少动态效果」设置下使用静态背景。

加入投递看板用于记录求职进度，不会向企业发送简历。岗位为已导入的400条历史样本，需核对企业当前公告。采集服务尚未接入，页面不生成虚假的采集任务或成功日志。邮箱作为登录标识，目前未接入验证码、邮箱归属验证或找回密码服务。

## 后端目录与项目书的对应

参考《爱吃巧乐兹队 项目计划书》第6～7页「3.3 后端目录结构」，本轮实现账号与求职数据保存所需的分层，未创建空的爬虫或推荐服务占位文件。

```text
backend/
  app/
    main.py                 # 入口、路由和安全中间件
    config.py               # 环境配置
    database.py             # SQLAlchemy 引擎与会话
    deps.py                 # 当前账号、上下文与管理员权限
    models/                 # 用户、登录会话、账号求职数据
    schemas/                # 账号与求职数据的 Pydantic 契约
    routers/                # auth、account、admin
    services/accounts.py    # 会话与独立求职数据业务
    utils/security.py       # 密码哈希与令牌摘要
  scripts/manage_user.py    # 管理员权限分配
  tests/test_api.py         # 真实账号接口回归
  data/                    # 本地默认账号库，首次运行自动创建
  requirements.txt
  requirements-test.txt
  .env.example
frontend/
  index.html                # 构建产物，由后端提供访问
  src/                      # 页面、样式、交互及历史岗位数据
scripts/
  build_frontend.py         # 前端构建
  check_frontend.mjs        # 独立测试服务与真实 Chrome 浏览器回归
启动平台.cmd
启动平台.ps1
```

技术栈为 FastAPI、Pydantic、SQLAlchemy，数据库支持 SQLite 与 MySQL。前端保留现有页面和算法实现。当前求职状态以每账号一个 JSON 记录及版本号保存，尚未拆成项目书规划的画像表、投递表和岗位服务；会话采用服务端可撤销 Cookie，并非 JWT。岗位和技能仍读取已导入的历史数据文件。

## 数据库配置

默认账号库为 backend/data/accounts.sqlite，所有个人求职数据通过后端写入，浏览器不持久保存密码、令牌或个人记录（离线演示模式除外，见上）。不导入旧版浏览器里的演示记录。

切换 MySQL 8.0：

1. 先创建专用的空数据库及具备建表、读写权限的账号。
2. 复制 backend/.env.example 为 backend/.env，填写 CAMPUS_DATABASE_URL，例如 mysql+pymysql://账号:经过URL编码的密码@127.0.0.1:3306/campus_compass?charset=utf8mb4 。
3. 重启平台，SQLAlchemy 自动创建本轮所需的三张表。

切换数据库不会自动迁移已有 SQLite 账号。此轮运行和接口测试使用 SQLite；没有连接或修改此电脑现有的 MySQL 业务库。真实 .env、数据库、备份和虚拟环境不应提交到仓库。服务默认仅监听127.0.0.1。

## 管理员

先通过页面注册维护者自己的账号，再在项目根目录运行：

```powershell
& .\backend\.venv\Scripts\python.exe .\backend\scripts\manage_user.py 你的邮箱 --role admin
```

重新登录后显示后台入口；改用 --role candidate 可撤销权限。普通注册请求无法指定管理员权限。

## 构建与验证

```powershell
# 构建前端
& .\backend\.venv\Scripts\python.exe .\scripts\build_frontend.py
# 安装开发检查依赖并执行后端回归
& .\backend\.venv\Scripts\python.exe -m pip install -r .\backend\requirements-test.txt
$env:PYTHONPATH=(Join-Path $PWD "backend")
& .\backend\.venv\Scripts\python.exe -m unittest discover -s .\backend\tests -v
# 浏览器回归，需要本机 Node.js 和 Chrome，使用独立临时数据库
node .\scripts\check_frontend.mjs
```

更多修改与验证说明见 docs/真实账号与动态背景修订说明.md。docs 中此前的原型说明、旧截图和历史归档描述的是早期版本，当前使用方式以本 README 为准。
