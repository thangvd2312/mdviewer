# Deploy mdviewer (k3s)

Từ 2026-11-10 mdviewer chạy trên **cụm k3s 3 máy**. Không còn pm2, self-hosted runner hay `~/apps/mdviewer` trên ZBook nữa.

Tài liệu này chỉ viết những gì liên quan tới mdviewer. Phần hạ tầng chung (dựng cụm, Longhorn, failover, cấp quyền, thêm node) nằm trong project **server-manage** trên mdviewer, bắt đầu từ note [00 - Tổng quan](https://mdviewer.baibyte.com/d/c760c125-4068-4241-a898-890dd46961b0).

## 1. Toàn cảnh

```
git push main
   │
   ▼
GitHub Actions (.github/workflows/deploy.yml)
   check ──► image ──► deploy ──► verify
   │          │          │          └─ chờ https://mdviewer.baibyte.com/api/health trả version = <sha>
   │          │          └─ ghi newTag: <sha> vào repo k8s-infra (apps/mdviewer/kustomization.yaml) và commit
   │          └─ build Dockerfile → ghcr.io/thangvd2312/mdviewer:<sha>  (+ :main)
   └─ npm run install:all && npm run check  (typecheck BE, lint FE, build cả hai)

Cụm k3s, namespace apps
   ArgoCD (hỏi repo k8s-infra mỗi 60 giây): thấy commit mới
      → sync apps/mdviewer: đổi image Deployment mdviewer sang :<sha>
      → rolling update: pod mới Ready rồi pod cũ mới tắt

Cloudflare ── tunnel "home-k3s" (cloudflared, 2 bản: ZBook + Jerry)
   mdviewer.baibyte.com     ─┐
   apimdviewer.baibyte.com  ─┴─► Service mdviewer:4100 ─► pod mdviewer (NestJS: /api, /docs + React build)
                                                               │
                                                               └─► AWS RDS mysql-dev:3306 (database mdviewer, user mdviewer)
                                                                    ngoài cụm, ap-southeast-1
```

| Thành phần | Ở đâu |
|---|---|
| Image | `ghcr.io/thangvd2312/mdviewer` (package private, node kéo bằng Secret `ghcr`) |
| App | `Deployment apps/mdviewer`, 1 bản, cổng 4100, health `GET /api/health` |
| Cấu hình (.env) | `Secret apps/mdviewer-env` |
| Database | AWS RDS `mysql-dev.czyg048igqyu.ap-southeast-1.rds.amazonaws.com` (MySQL 8.4), database `mdviewer`, user riêng `mdviewer` (chỉ có quyền trên `mdviewer.*`). Từ 2026-11-25; trước đó là `StatefulSet apps/mysql`, đã gỡ |
| Backup | `CronJob apps/db-backup`, chạy 0h/6h/12h/18h, lưu lên Cloudflare R2 bằng restic |
| Domain | Tunnel `home-k3s` (remote-managed), sửa bằng `scripts/route.sh` trong repo k8s-infra |
| Manifest | Repo private [`thangvd2312/k8s-infra`](https://github.com/thangvd2312/k8s-infra), thư mục `apps/mdviewer/`, do ArgoCD đồng bộ (từ 2026-11-26) |

**Cụm có 3 máy, cả 3 đều là control-plane (etcd):**

| Máy | IP Tailscale | Vai trò |
|---|---|---|
| ZBook `thangvv-hp-zbook-15-g2` | 100.123.48.95 | Chạy app, ưu tiên nhất (app và DB đều thích nằm ở đây) |
| Jerry `jerry-x450cp` | 100.104.17.19 | Chạy app, nhận pod khi ZBook chết (sau khoảng 30 giây) |
| Lightsail SGP `ip-172-26-3-131` | 100.112.159.27 | Chỉ giữ quorum (taint `witness:NoSchedule`), không chạy app |

Cụm cần **2/3 máy sống** mới hoạt động, nên không được tắt hoặc reboot 2 máy cùng lúc.

## 2. Deploy một thay đổi

Chỉ cần **push lên `main`**, không phải làm gì thêm.

1. Chạy kiểm tra ở máy trước, giống hệt job `check` trên CI:
   ```bash
   npm run install:all   # lần đầu, hoặc khi dependencies đổi
   npm run check
   ```
2. `git push origin main`.
3. Theo dõi:
   ```bash
   gh run watch                    # cả 4 job; "verify" xanh = bản mới đã thật sự chạy trên k3s
   kubectl -n apps get pods -l app=mdviewer -w
   kubectl -n argocd get app mdviewer                     # Synced/OutOfSync, Healthy/Progressing/Degraded
   curl -s https://mdviewer.baibyte.com/api/health        # version = commit đang chạy
   ```

Thời gian: build image khoảng 3–10 phút, cộng tối đa 1 phút chờ ArgoCD, cộng thời gian pod mới khởi động.

**PR và nhánh khác** chỉ chạy job `check`, không build image và không bao giờ chạm vào cụm.

**Tạm dừng deploy tự động** (CI vẫn ghi tag mới vào k8s-infra, nhưng cụm không đổi cho tới khi bật lại):
```bash
kubectl -n argocd patch app mdviewer --type merge -p '{"spec":{"syncPolicy":{"automated":null}}}'   # tạm dừng
kubectl apply -f ~/Desktop/Project/me/k8s-infra/argocd/apps/mdviewer.yaml                          # bật lại
```

## 3. Migration database

- Migration TypeORM (`backend/src/migrations`) **tự chạy lúc app khởi động** (`DB_MIGRATIONS_RUN=true`), không có bước riêng.
- Deployment dùng `RollingUpdate`: pod mới khởi động và chạy migration **trong lúc pod cũ vẫn đang phục vụ**. Pod cũ chỉ tắt khi pod mới đã Ready.

Vì vậy migration phải **tương thích ngược**, tức code cũ vẫn chạy được trên schema mới:
- An toàn: thêm bảng, thêm cột nullable hoặc có default, thêm index.
- Phải tách làm 2 lần deploy: đổi tên hoặc xoá cột/bảng. Lần đầu deploy code không còn dùng cột đó; lần sau mới xoá cột.

**Không có backup tự động trước khi deploy mdviewer.** Khác với dautu (có Job PreSync backup DB trước mỗi lần sync). Trước khi push migration có rủi ro (xoá hoặc sửa dữ liệu), chọn một trong hai cách:
```bash
# Cách 1: backup tay rồi mới push
kubectl -n apps create job --from=cronjob/db-backup db-backup-manual-$(date +%s)
kubectl -n apps get jobs -w        # chờ COMPLETIONS 1/1

# Cách 2: bật backup trước mọi lần deploy (giống dautu)
#   chép apps/dautu/predeploy-rbac.yaml + predeploy-backup.yaml của repo k8s-infra sang apps/mdviewer/,
#   đổi tên dautu -> mdviewer, thêm 2 file vào kustomization.yaml rồi push
```

Pod có tối đa khoảng 60 + 5×20 giây (theo liveness probe) để chạy xong migration và trả `/api/health`. Migration có backfill nặng thì phải tính tới giới hạn này.

Tạo migration mới vẫn làm như trước, xem mục *Database* trong README.

## 4. Khi deploy lỗi và rollback

**Không tự rollback.** Pod mới không Ready thì pod cũ vẫn phục vụ (rolling update), app trên ArgoCD báo `Degraded`, job `verify` trên GitHub đỏ sau 20 phút.

**Quay về bản trước ngay, không chờ build:** revert commit đổi tag trong repo k8s-infra. ArgoCD đưa cụm về tag cũ trong khoảng 1 phút.
```bash
cd ~/Desktop/Project/me/k8s-infra && git pull
git log --oneline -- apps/mdviewer          # mỗi lần deploy là 1 commit "mdviewer: <sha> …"
git revert <commit lỗi> && git push
```
Sau đó sửa code rồi push mdviewer như bình thường (hoặc `git revert` trong repo mdviewer).

**Không dùng `kubectl rollout undo` hay `kubectl edit`**: ArgoCD (selfHeal) sẽ đưa cụm về đúng như Git ngay sau đó.

Rollback **không** hoàn tác migration. Nếu bản lỗi đã đổi schema, phải viết migration sửa lại, hoặc khôi phục từ backup (mục 7).

## 5. Cấu hình (biến môi trường)

Toàn bộ `.env` production nằm trong **Secret `apps/mdviewer-env`**. Danh sách biến và ý nghĩa xem ở `.env.production.example`. Có vài giá trị khác với file mẫu đó, vì trong k3s:

| Biến | Giá trị trong k3s |
|---|---|
| `DB_HOST` / `DB_PORT` | `mysql-dev.czyg048igqyu.ap-southeast-1.rds.amazonaws.com` / `3306` |
| `DB_NAME` / `DB_USER` | `mdviewer` / `mdviewer` |
| `HOST` | `0.0.0.0` (cloudflared gọi vào qua Service) |
| `PORT` | Không đặt. Image mặc định `4100`, khớp với Service và probe |
| `ASSISTANT_API_KEY` | Nằm ở đây. GitHub secret `ASSISTANT_API_KEY` **không còn được dùng** |
| `ALLOWED_ORIGINS` | `http://localhost:5173`, để chạy frontend ở máy với API production. Kiểm tra bằng lệnh xem tên biến bên dưới |

```bash
# Xem tên các biến (không in giá trị)
kubectl -n apps get secret mdviewer-env -o json | jq -r '.data | keys[]'

# Đọc một biến
kubectl -n apps get secret mdviewer-env -o jsonpath='{.data.ASSISTANT_MODEL}' | base64 -d; echo

# Sửa hoặc thêm một biến, rồi khởi động lại để app đọc (env chỉ đọc lúc khởi động)
kubectl -n apps patch secret mdviewer-env --type merge -p '{"stringData":{"ASSISTANT_MODEL":"cx/gpt-6.1-sol"}}'
kubectl -n apps rollout restart deploy/mdviewer

# Xoá một biến
kubectl -n apps patch secret mdviewer-env --type json -p '[{"op":"remove","path":"/data/TEN_BIEN"}]'
```
Giá trị bí mật như API key thì nhập qua `read -s` để không bị lưu vào lịch sử shell:
`read -s K && kubectl -n apps patch secret mdviewer-env --type merge -p "{\"stringData\":{\"ASSISTANT_API_KEY\":\"$K\"}}"`.

Muốn tạo lại toàn bộ Secret từ một file `.env` (bỏ nháy giống `node --env-file`), dùng `scripts/env2secret.py` trong repo k8s-infra:
```bash
python3 ~/Desktop/Project/me/k8s-infra/scripts/env2secret.py mdviewer-env apps DB_HOST=mysql-dev.czyg048igqyu.ap-southeast-1.rds.amazonaws.com DB_PORT=3306 HOST=0.0.0.0 -PORT \
  < mdviewer.env | kubectl apply -f -
```

## 6. Log, khởi động lại, vào DB

```bash
kubectl -n apps get pods -l app=mdviewer -o wide         # pod ở máy nào, restart bao nhiêu lần
kubectl -n apps logs -f deploy/mdviewer                  # log trực tiếp
kubectl -n apps logs deploy/mdviewer --previous          # log của lần vừa crash
kubectl -n apps logs deploy/mdviewer -c wait-db          # pod kẹt ở Init: đang chờ RDS (mạng ra AWS?)
kubectl -n apps describe pod -l app=mdviewer             # Events: pull image lỗi, OOMKilled, probe fail…
kubectl -n apps rollout restart deploy/mdviewer          # khởi động lại, không downtime

# MySQL bằng TablePlus/DBeaver: nối thẳng mysql-dev.czyg048igqyu.ap-southeast-1.rds.amazonaws.com:3306,
# user và mật khẩu lấy từ Secret mdviewer-env (DB_USER, DB_PASSWORD). Cần Security Group của RDS cho phép IP của bạn.

# Shell mysql từ trong cụm (pod tạm, tự xoá khi thoát)
kubectl -n apps run mysql-client --rm -it --restart=Never --image=mysql:8.4 \
  --env="MYSQL_PWD=$(kubectl -n apps get secret mdviewer-env -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)" \
  -- mysql -h mysql-dev.czyg048igqyu.ap-southeast-1.rds.amazonaws.com -umdviewer mdviewer
```
- App **không ghi log cho từng request**, chỉ ghi lúc khởi động, cảnh báo và lỗi. Log trống khi bạn đang click trên trang là bình thường.
- Pod bị xoá hoặc chuyển sang máy khác thì log cũ mất theo.
- `kubectl` mặc định đi qua Lightsail. Lightsail chết thì thêm `--context home-k3s-zbook` (hoặc `home-k3s-jerry`).

## 7. Backup và khôi phục

- `CronJob db-backup` chạy mỗi 6 tiếng: dump `kiwi`, `mdviewer` (MySQL trên RDS, mỗi DB bằng user của chính app) và `dautu` (Postgres trong cụm), rồi đẩy lên R2 bằng restic có mã hoá.
- Restic giữ 28 bản gần nhất, cộng 14 bản theo ngày, 8 bản theo tuần, 12 bản theo tháng.
- Chạy tay: `kubectl -n apps create job --from=cronjob/db-backup db-backup-manual-$(date +%s)`.
- Cách lấy một bản dump ra và khôi phục: xem `~/server-manage/backup/restore-test.sh` và note giai đoạn backup trong project server-manage.

Khôi phục riêng database mdviewer từ file `mdviewer.sql.gz`. **Nên** tạm `scale --replicas=0` app trước để không có ghi mới chen vào. Phải tắt auto-sync của ArgoCD trước, nếu không nó sẽ đưa replicas về 1 ngay:
```bash
kubectl -n argocd patch app mdviewer --type merge -p '{"spec":{"syncPolicy":{"automated":null}}}'
kubectl -n apps scale deploy/mdviewer --replicas=0
gunzip -c mdviewer.sql.gz | kubectl -n apps run mysql-restore --rm -i --restart=Never --image=mysql:8.4 \
  --env="MYSQL_PWD=$(kubectl -n apps get secret mdviewer-env -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)" \
  -- mysql -h mysql-dev.czyg048igqyu.ap-southeast-1.rds.amazonaws.com -umdviewer
kubectl apply -f ~/Desktop/Project/me/k8s-infra/argocd/apps/mdviewer.yaml   # bật lại auto-sync -> replicas về 1
```
File dump được tạo bằng `--databases mdviewer`, nên nó tự `CREATE DATABASE`/`USE mdviewer`.

## 8. Domain

Cả hai domain đều trỏ về cùng một Service:

| Hostname | Service |
|---|---|
| `mdviewer.baibyte.com` | `http://mdviewer.apps.svc.cluster.local:4100` |
| `apimdviewer.baibyte.com` | `http://mdviewer.apps.svc.cluster.local:4100` |

```bash
cd ~/Desktop/Project/me/k8s-infra/scripts    # cần file .cf-token (token Cloudflare, không có trong git) cạnh route.sh
./route.sh list
./route.sh add <hostname> http://mdviewer.apps.svc.cluster.local:4100 --yes   # thêm domain (tự tạo DNS CNAME)
```
Đổi domain chính thì sửa thêm 3 chỗ:
- `FRONTEND_URL` và `GITHUB_CALLBACK_URL` trong Secret;
- callback URL của GitHub OAuth App;
- `ALLOWED_ORIGINS`, nếu domain mới cần gọi API từ một site khác.

## 9. Chạy frontend ở máy với API production

Copy `frontend/.env.example` thành `frontend/.env`, đặt `VITE_API_URL=https://apimdviewer.baibyte.com`, rồi `cd frontend && npm run dev`. Đăng nhập GitHub như bình thường, token tự quay về localhost.

- Cần `ALLOWED_ORIGINS=http://localhost:5173` trong Secret (mục 5).
- **Đây là dữ liệu thật**: sửa hay xoá ở máy là sửa hay xoá trên production.

## 10. Những điểm cần biết

- **Manifest nằm trong repo k8s-infra, do ArgoCD quản lý.** Muốn đổi Deployment (RAM, probe, biến `env`…) thì sửa `apps/mdviewer/` trong repo đó rồi push, không `kubectl apply`/`edit` tay.
- **Chỉ chạy 1 bản.** Lúc ZBook chết đột ngột, mdviewer gián đoạn vài phút: pod dời sang Jerry sau khoảng 30 giây, cộng thời gian khởi động. Database nằm trên RDS nên không bị ảnh hưởng. Khi cần bảo trì ZBook thì chạy `kubectl drain` trước. Chi tiết trong note "06 - Test failover".
- **CI ghi vào k8s-infra bằng deploy key** (secret `INFRA_DEPLOY_KEY` của repo này, chỉ ghi được đúng repo k8s-infra). Key bị xoá thì job `deploy` đỏ.
- **Pipeline cũ đã gỡ hết**: pm2, `~/apps/mdviewer`, self-hosted runner, tunnel "home". `.env.production.example` giờ chỉ còn là danh sách biến.
