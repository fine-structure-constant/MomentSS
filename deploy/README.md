# MomentSS：Rocky Linux + Cloudflare Tunnel 自动部署

适用于当前公开仓库 `fine-structure-constant/MomentSS`、服务器账号 `rocky`。
网站域名：`https://momentss.renschekhe.site`。

流程：push main → GitHub 测试与构建 → 发布完整 GitHub Release → 服务器下载、验证 → 切换 current。
GitHub 构建结束后，服务器约 1 分钟内检查新版本（另有几秒定时器误差及下载时间）。
服务器只下载静态文件，不执行 Release 中的程序，不需要 Node.js、GitHub token 或入站 SSH。
现有博客、Anubis 和证书配置不参与新站点。

## 1. 提交项目中的部署文件

将本次新增的 `.github/workflows/deploy.yml`、整个 `deploy/`、README 和 `.gitignore` 推送到 main。
在 GitHub 仓库的 Actions 查看 **Publish MomentSS deployment**。
也可以选择这个工作流，点击 Run workflow，选择 main，手动重试。

工作流使用内置 `GITHUB_TOKEN` 的 `contents: write` 权限，无需额外添加 Secrets。
如果仓库或组织策略禁止此权限，需要在仓库 Actions 设置中允许相应权限。
若启用了不可变 Releases，工作流先创建草稿并上传资产，再发布。

成功后，Releases 应出现 `deploy-运行编号-重试编号-提交前12位`，包含：

- `deployment.json`：仓库、main 分支、提交、版本标签、大小与 SHA-256。
- `momentss.tar.gz`：构建后的静态网站。

服务器通过 GitHub 官方 Latest Release 下载地址检查版本，不轮询 GitHub REST API，因此无需每分钟消耗 API 配额。
部署工作流会设置此 Release 为 **Latest**。如果手工发布其他 Release，不要将其标为 Latest，否则服务器找不到部署清单，会保持原站点并记录日志。
旧工作流发现 main 已有新提交时会跳过发布；部署工作流串行运行。

参考：[GitHub Latest Release 下载链接](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)、[GitHub CLI 发布命令](https://cli.github.com/manual/gh_release_create)。

## 2. 在服务器安装部署工具（以 rocky 登录）

以下命令都在 Rocky 服务器执行，不是在本地 Windows 执行。
应用数据和下载均在 `/home/rocky/data/service/momentss`；只有 Nginx 和 systemd 的小配置文件安装到 `/etc`。

```bash
sudo dnf install -y python3 git acl

mkdir -p ~/data/service/momentss
cd ~/data/service/momentss
git clone https://github.com/fine-structure-constant/MomentSS.git source
install -d -m 755 tools releases
cp -R source/deploy/server/momentss_deploy tools/
cp source/deploy/config.example.json config.json
chmod 755 /home/rocky/data/service/momentss
```

如果 `source` 已存在，先检查它是否是本仓库，再进入 source 执行 `git pull --ff-only`，不要重复 clone。
将工具、配置复制出来是为了让运行目录稳定。以后网页更新只下载构建产物；修改部署工具时要手工复制新的 `momentss_deploy` 并重新安装变更的服务配置。

配置文件 `config.json` 可以调整仓库、健康检查地址、下载超时和保留版本数量。
默认不使用代理，也不继承登录 shell 的代理环境变量。
如果服务器直连 GitHub 下载失败，可将 `proxy_url` 改为你现有的本地 HTTP 代理地址：

```json
"proxy_url": "http://127.0.0.1:7890"
```

仅 GitHub 下载走这个代理，Nginx 健康检查始终直连本机。
先验证下载通路（首个 Release 尚未发布时会返回 404）：

```bash
curl -fIL https://github.com/fine-structure-constant/MomentSS/releases/latest/download/deployment.json
# 需要代理时：
curl -x http://127.0.0.1:7890 -fIL https://github.com/fine-structure-constant/MomentSS/releases/latest/download/deployment.json
```

## 3. 为 Nginx 增加独立静态站点

当前 Nginx 直接运行在宿主机，使用 `/etc/nginx/nginx.conf`；提供的监听列表中 18080 未占用。
安装前再次检查 `sudo ss -lntp`，确认 18080 仍未被其他进程使用。
确认现有 nginx.conf 的 `http {}` 包含 `include /etc/nginx/conf.d/*.conf;`。
如果使用其他 include 目录，把 momentss.conf 安装到该目录，保留其他站点配置。

Nginx 需要穿过父目录，并读取发布目录；下面 ACL 只给予父目录穿过权限，不给予列举家目录的权限：
这里按默认 worker 账号 `nginx` 配置；如果现有 nginx.conf 的 `user` 指令改过账号，将 ACL 命令中的 `nginx` 替换为实际账号。

```bash
sudo setfacl -m u:nginx:--x /home/rocky /home/rocky/data /home/rocky/data/service
sudo install -m 644 /home/rocky/data/service/momentss/source/deploy/nginx/momentss.conf \
  /etc/nginx/conf.d/momentss.conf
sudo nginx -t
```

**只有 nginx -t 成功后才执行 reload**：

```bash
sudo systemctl reload nginx
```

没有首个部署时，访问网站是 404，这属于正常现象。首次更新会填充 current。
这里只监听 `127.0.0.1:18080`，无需开放外部防火墙端口。
Nginx 的这个静态站点没有 `proxy_pass`，不会转到博客。

当前 SELinux 为 **Permissive**，不会阻止访问。不要为了本部署关闭 SELinux。
若未来改成 Enforcing，需要给站点文件设置 `httpd_sys_content_t`、给 18080 设置 `http_port_t`，并检查家目录穿过权限和 AVC 日志。
本项目不自动改变全机 SELinux 策略。
例如内容标签可用 `semanage fcontext` 配合 `restorecon` 持久配置；后续下载文件需继承正确目录标签。
参考：[RHEL 9 Nginx 与内容标签](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/deploying_web_servers_and_reverse_proxies/setting-up-and-configuring-nginx_deploying-web-servers-and-reverse-proxies)。

## 4. 首次下载并启动自动更新

可先在服务器运行部署测试，Linux 会验证实际的目录链接切换：

```bash
cd /home/rocky/data/service/momentss/source
python3 -B -m unittest discover -s deploy/tests -v
```

手动运行首次更新（确保步骤 1 已经成功发布 Release、步骤 3 已 reload）：

```bash
cd /home/rocky/data/service/momentss/tools
python3 -B -m momentss_deploy --config /home/rocky/data/service/momentss/config.json
curl -f http://127.0.0.1:18080/version.json
curl -I http://127.0.0.1:18080/
```

预期日志为 `Activated deploy-...`；version.json 中有对应 tag 和 commit。
如果尚无 Release，工具记录提示并退出，后续 timer 会重试。
下载、校验或解包失败不会切换 current；切换后健康检查失败则恢复旧链接。

安装定时任务：

```bash
sudo install -m 644 /home/rocky/data/service/momentss/source/deploy/systemd/momentss-update.service \
  /etc/systemd/system/momentss-update.service
sudo install -m 644 /home/rocky/data/service/momentss/source/deploy/systemd/momentss-update.timer \
  /etc/systemd/system/momentss-update.timer
sudo systemctl daemon-reload
sudo systemctl enable --now momentss-update.timer
systemctl list-timers momentss-update.timer
```

服务以 rocky 运行。`RequiresMountsFor` 等待数据盘挂载，服务只允许写入本应用目录。
配置或静态网页更新不需要重启 Nginx；systemd 服务读 config.json 的最新内容。
默认保留最新 5 个本地版本，并额外保护当前版本及刚替换的版本。
GitHub 端旧 Releases 不自动删除。

## 5. 给现有 Cloudflare Tunnel 增加域名

cloudflared 和 Nginx 都在宿主机，可以直接使用回环地址。

如果 Tunnel 在 Cloudflare 控制台管理，找到现有 Tunnel 的 **Published application routes / Public Hostnames**，新增：

| 设置 | 值 |
| --- | --- |
| Subdomain | `momentss` |
| Domain | `renschekhe.site` |
| Service Type | `HTTP` |
| Service URL | `127.0.0.1:18080` |

浏览器访问 `https://momentss.renschekhe.site`；HTTPS 由 Cloudflare 接入层提供，Tunnel 到本机 Nginx 使用 HTTP，无需复用博客自签证书。
如果已有同名 DNS 记录，先确认它的用途，避免产生冲突。
如果 Cloudflare 中已有覆盖全域名的重定向、缓存或 Access 规则，需要检查是否也作用于该子域名；不要给 HTML/version.json 设置强制长期缓存。

如果使用本地 YAML 管理 Tunnel，在现有 ingress 中加入以下条目，放在任何会匹配该域名的通配规则和最终兜底规则之前：

```yaml
ingress:
  - hostname: momentss.renschekhe.site
    service: http://127.0.0.1:18080
  # 原有博客等条目继续保留
  # 原有最终兜底条目继续放在最后
```

本地管理还需将这个子域名 DNS 路由到现有 Tunnel，可使用：

```bash
cloudflared tunnel route dns <现有Tunnel名称或UUID> momentss.renschekhe.site
```

该命令需要本机已有 Cloudflare 管理凭据。不要为此把 token 或 cert.pem 内容贴到聊天或仓库。
本地 YAML 改动先用现有配置路径执行 `cloudflared tunnel --config <配置路径> ingress validate`，成功后再 reload/restart cloudflared。
重启会使同一 Tunnel 上的服务短暂重连，建议选择合适时间。
不要覆盖整个 cloudflared.service 或整个 Tunnel 配置。
参考：[Cloudflare 主机名路由](https://developers.cloudflare.com/tunnel/concepts/routing/)。

## 日常更新、排查、回滚

完成首次设置后只需要正常 push main，构建通过并发布后服务器自动更新。
浏览器旧标签页需要刷新才能加载新版网页。

```bash
# 最新部署日志
journalctl -u momentss-update.service -n 60 --no-pager
# 立即触发一次检查
sudo systemctl start momentss-update.service
# 当前版本
readlink /home/rocky/data/service/momentss/current
# Nginx 错误
sudo tail -n 40 /var/log/nginx/momentss-error.log
# 父目录权限与标签
namei -l /home/rocky/data/service/momentss/current/index.html
```

403 先检查 Nginx 的运行账号和父目录 ACL；SELinux 已改 Enforcing 时也要检查 AVC。
502 先检查 Tunnel 的 service URL 和 `curl http://127.0.0.1:18080/`。
下载超时先测试 GitHub 直连/代理，并检查 config.json 的 proxy_url。
如果下载失败，下一次 timer 会重试，已有网站继续服务。

手动回滚前停止定时器，否则下一次检查会再次部署 GitHub Latest：

```bash
sudo systemctl stop momentss-update.timer
# 等待正在执行的检查完成；显示 inactive 后再继续
systemctl is-active momentss-update.service
ls /home/rocky/data/service/momentss/releases
cd /home/rocky/data/service/momentss/tools
python3 -B -m momentss_deploy --config /home/rocky/data/service/momentss/config.json \
  --rollback <上一步列表中的旧版本标签>
```

准备恢复自动更新时，先在 main 修复问题并发布新版本，然后：

```bash
sudo systemctl start momentss-update.timer
```

如果需要彻底撤销新站点，停用并禁用 momentss-update.timer，移除本次新增的 Nginx 配置并在 `nginx -t` 成功后 reload，最后删除 Tunnel 中新增的这个子域名路由即可。先保留部署数据以便恢复。
