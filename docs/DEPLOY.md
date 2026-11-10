# Deploy mdviewer (k3s)

Từ 2026-11-10 mdviewer chạy trên **cụm k3s 3 máy**. Không còn pm2, self-hosted runner hay `~/apps/mdviewer` trên ZBook nữa.

Tài liệu này chỉ viết những gì liên quan tới mdviewer. Phần hạ tầng chung (dựng cụm, Longhorn, failover, cấp quyền, thêm node) nằm trong project **server-manage** trên mdviewer, bắt đầu từ note [00 - Tổng quan](https://mdviewer.thangvu.io.vn/d/c760c125-4068-4241-a898-890dd46961b0).

## 1. Toàn cảnh

```
git push main
   │
   ▼
GitHub Actions (.github/workflows/deploy.yml)
   check ──► image ──► verify
   │          │          └─ chờ commit status "k3s/mdviewer" (k3s báo về)
   │          └─ build Dockerfile → ghcr.io/thangvd2312/mdviewer:main  (+ :<sha>)
   └─ npm run install:all && npm run check  (typecheck BE, lint FE, build cả hai)

Cụm k3s, namespace apps
   CronJob autodeploy (2 phút/lần): thấy digest của :main đổi
      → kubectl set image deploy/mdviewer *=…:main@sha256:…
      → chờ pod mới Ready (tối đa 10 phút)
      → OK: báo status success · lỗi: rollout undo + status failure

Cloudflare ── tunnel "home-k3s" (cloudflared, 2 bản: ZBook + Jerry)
   mdviewer.thangvu.io.vn     ─┐
   apimdviewer.thangvu.io.vn  ─┴─► Service mdviewer:4100 ─► pod mdviewer (NestJS: /api, /docs + React build)
                                                               │
                                                               └─► Service mysql:3306 ─► StatefulSet mysql (database mdviewer)
                                                                    dữ liệu trên Longhorn, 2 bản sao (ZBook + Jerry)
```

| Thành phần | Ở đâu |
|---|---|
| Image | `ghcr.io/thangvd2312/mdviewer` (package private, node kéo bằng Secret `ghcr`) |
| App | `Deployment apps/mdviewer`, 1 bản, cổng 4100, health `GET /api/health` |
| Cấu hình (.env) | `Secret apps/mdviewer-env` |
| Database | `StatefulSet apps/mysql` (MySQL 8.4), database `mdviewer`, dùng chung với kiwi |
| Backup | `CronJob apps/db-backup`, chạy 0h/6h/12h/18h, lưu lên Cloudflare R2 bằng restic |
| Domain | Tunnel `home-k3s` (remote-managed), sửa bằng `~/server-manage/k8s/route.sh` |
| Manifest | `~/server-manage/k8s/*.yaml` trên máy Mac (**chưa có trong git**, xem mục 10) |

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
   gh run watch                    # cả 3 job; "verify" xanh = bản mới đã thật sự chạy trên k3s
   kubectl -n apps get pods -l app=mdviewer -w
   kubectl -n apps get deploy mdviewer -o jsonpath='{.metadata.annotations.autodeploy\.thangvv/revision}'   # commit đang chạy
   ```

Thời gian: build image khoảng 3–10 phút, cộng tối đa 2 phút chờ autodeploy, cộng thời gian pod mới khởi động.

**PR và nhánh khác** chỉ chạy job `check`, không build image và không bao giờ chạm vào cụm.

**Không muốn chờ 2 phút, hoặc muốn tạm dừng deploy tự động:**
```bash
kubectl -n apps create job --from=cronjob/autodeploy autodeploy-manual-$(date +%s)   # chạy ngay
kubectl -n apps patch cronjob autodeploy -p '{"spec":{"suspend":true}}'              # tạm dừng
kubectl -n apps patch cronjob autodeploy -p '{"spec":{"suspend":false}}'             # bật lại

# log lượt autodeploy gần nhất
kubectl -n apps logs job/$(kubectl -n apps get job -l app=autodeploy --sort-by=.metadata.creationTimestamp -o name | tail -1 | cut -d/ -f2)
```
Autodeploy phục vụ chung cho kiwi, dautu và mdviewer, nên tạm dừng là dừng cả bốn deployment.

## 3. Migration database

- Migration TypeORM (`backend/src/migrations`) **tự chạy lúc app khởi động** (`DB_MIGRATIONS_RUN=true`), không có bước riêng.
- Deployment dùng `RollingUpdate`: pod mới khởi động và chạy migration **trong lúc pod cũ vẫn đang phục vụ**. Pod cũ chỉ tắt khi pod mới đã Ready.

Vì vậy migration phải **tương thích ngược**, tức code cũ vẫn chạy được trên schema mới:
- An toàn: thêm bảng, thêm cột nullable hoặc có default, thêm index.
- Phải tách làm 2 lần deploy: đổi tên hoặc xoá cột/bảng. Lần đầu deploy code không còn dùng cột đó; lần sau mới xoá cột.

**Không có backup tự động trước khi deploy mdviewer.** Khác với dautu: deployment mdviewer chưa có annotation `autodeploy.thangvv/pre-job`. Trước khi push migration có rủi ro (xoá hoặc sửa dữ liệu), chọn một trong hai cách:
```bash
# Cách 1: backup tay rồi mới push
kubectl -n apps create job --from=cronjob/db-backup db-backup-manual-$(date +%s)
kubectl -n apps get jobs -w        # chờ COMPLETIONS 1/1

# Cách 2: bật backup trước mọi lần deploy (giống dautu)
kubectl -n apps annotate deploy/mdviewer autodeploy.thangvv/pre-job=db-backup
#   và thêm dòng đó vào phần annotations của mdviewer trong ~/server-manage/k8s/apps.yaml
```

Pod có tối đa khoảng 60 + 5×20 giây (theo liveness probe) để chạy xong migration và trả `/api/health`. Migration có backfill nặng thì phải tính tới giới hạn này.

Tạo migration mới vẫn làm như trước, xem mục *Database* trong README.

## 4. Khi deploy lỗi và rollback

**Tự động:** nếu pod mới không Ready trong 10 phút, autodeploy làm 3 việc:
- chạy `rollout undo` về bản cũ;
- ghi digest lỗi vào annotation `autodeploy.thangvv/failed-digest`, để các lượt sau bỏ qua digest đó cho tới khi có image mới;
- báo status `failure`, nên job `verify` trên GitHub đỏ.

**Tự quay về bản trước:** nên làm qua git để code và cụm luôn khớp nhau:
```bash
git revert <commit> && git push origin main
```

Muốn quay ngay mà không chờ build: undo, rồi **đánh dấu digest hiện tại của `:main` là lỗi**. Nếu bỏ bước đánh dấu, lượt autodeploy 2 phút sau sẽ đưa bản lỗi trở lại.
```bash
BAD=$(kubectl -n apps get deploy mdviewer -o jsonpath='{.spec.template.spec.containers[0].image}' | sed 's/.*@//')
kubectl -n apps rollout undo deploy/mdviewer
kubectl -n apps annotate deploy/mdviewer --overwrite autodeploy.thangvv/failed-digest="$BAD"
kubectl -n apps rollout history deploy/mdviewer
```

`rollout undo` **không** hoàn tác migration. Nếu bản lỗi đã đổi schema, phải viết migration sửa lại, hoặc khôi phục từ backup (mục 7).

## 5. Cấu hình (biến môi trường)

Toàn bộ `.env` production nằm trong **Secret `apps/mdviewer-env`**. Danh sách biến và ý nghĩa xem ở `.env.production.example`. Có vài giá trị khác với file mẫu đó, vì trong k3s:

| Biến | Giá trị trong k3s |
|---|---|
| `DB_HOST` / `DB_PORT` | `mysql.apps.svc.cluster.local` / `3306` |
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

Muốn tạo lại toàn bộ Secret từ một file `.env` (bỏ nháy giống `node --env-file`), dùng `~/server-manage/k8s/env2secret.py`:
```bash
python3 ~/server-manage/k8s/env2secret.py mdviewer-env apps DB_HOST=mysql.apps.svc.cluster.local DB_PORT=3306 HOST=0.0.0.0 -PORT \
  < mdviewer.env | kubectl apply -f -
```

## 6. Log, khởi động lại, vào DB

```bash
kubectl -n apps get pods -l app=mdviewer -o wide         # pod ở máy nào, restart bao nhiêu lần
kubectl -n apps logs -f deploy/mdviewer                  # log trực tiếp
kubectl -n apps logs deploy/mdviewer --previous          # log của lần vừa crash
kubectl -n apps logs deploy/mdviewer -c wait-db          # pod kẹt ở Init: đang chờ MySQL
kubectl -n apps describe pod -l app=mdviewer             # Events: pull image lỗi, OOMKilled, probe fail…
kubectl -n apps rollout restart deploy/mdviewer          # khởi động lại, không downtime

# MySQL bằng TablePlus/DBeaver: 127.0.0.1:3308, user và mật khẩu lấy từ Secret mdviewer-env (DB_USER, DB_PASSWORD)
# (3307 ở máy Mac thường đã bị container MySQL local chiếm)
kubectl -n apps port-forward svc/mysql 3308:3306

# Shell mysql ngay trong pod
kubectl -n apps exec -it mysql-0 -- sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot mdviewer'
```
- App **không ghi log cho từng request**, chỉ ghi lúc khởi động, cảnh báo và lỗi. Log trống khi bạn đang click trên trang là bình thường.
- Pod bị xoá hoặc chuyển sang máy khác thì log cũ mất theo.
- `kubectl` mặc định đi qua Lightsail. Lightsail chết thì thêm `--context home-k3s-zbook` (hoặc `home-k3s-jerry`).

## 7. Backup và khôi phục

- `CronJob db-backup` chạy mỗi 6 tiếng: dump `kiwi`, `mdviewer` (MySQL) và `dautu` (Postgres), rồi đẩy lên R2 bằng restic có mã hoá.
- Restic giữ 28 bản gần nhất, cộng 14 bản theo ngày, 8 bản theo tuần, 12 bản theo tháng.
- Chạy tay: `kubectl -n apps create job --from=cronjob/db-backup db-backup-manual-$(date +%s)`.
- Cách lấy một bản dump ra và khôi phục: xem `~/server-manage/backup/restore-test.sh` và note giai đoạn backup trong project server-manage.

Khôi phục riêng database mdviewer từ file `mdviewer.sql.gz`. **Nên** tạm `scale --replicas=0` app trước để không có ghi mới chen vào:
```bash
kubectl -n apps scale deploy/mdviewer --replicas=0
gunzip -c mdviewer.sql.gz | kubectl -n apps exec -i mysql-0 -- sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot'
kubectl -n apps scale deploy/mdviewer --replicas=1
```
File dump được tạo bằng `--databases mdviewer`, nên nó tự `CREATE DATABASE`/`USE mdviewer`.

## 8. Domain

Cả hai domain đều trỏ về cùng một Service:

| Hostname | Service |
|---|---|
| `mdviewer.thangvu.io.vn` | `http://mdviewer.apps.svc.cluster.local:4100` |
| `apimdviewer.thangvu.io.vn` | `http://mdviewer.apps.svc.cluster.local:4100` |

```bash
cd ~/server-manage/k8s
./route.sh list
./route.sh add <hostname> http://mdviewer.apps.svc.cluster.local:4100 --yes   # thêm domain (tự tạo DNS CNAME)
```
Đổi domain chính thì sửa thêm 3 chỗ:
- `FRONTEND_URL` và `GITHUB_CALLBACK_URL` trong Secret;
- callback URL của GitHub OAuth App;
- `ALLOWED_ORIGINS`, nếu domain mới cần gọi API từ một site khác.

## 9. Chạy frontend ở máy với API production

Copy `frontend/.env.example` thành `frontend/.env`, đặt `VITE_API_URL=https://apimdviewer.thangvu.io.vn`, rồi `cd frontend && npm run dev`. Đăng nhập GitHub như bình thường, token tự quay về localhost.

- Cần `ALLOWED_ORIGINS=http://localhost:5173` trong Secret (mục 5).
- **Đây là dữ liệu thật**: sửa hay xoá ở máy là sửa hay xoá trên production.

## 10. Những điểm cần biết

- **Manifest chưa có trong git.** `~/server-manage/k8s` (apps.yaml, autodeploy.yaml, databases.yaml…) chỉ có trên máy Mac. Nên đưa vào một repo private. `route.sh` chứa token Cloudflare, nên tách token ra trước khi commit.
- **`kubectl apply -f apps.yaml` sẽ đưa image về `:main`** (bỏ ghim digest), làm pod khởi động lại một lần. Lần chạy autodeploy sau sẽ ghim lại.
- **Chỉ chạy 1 bản.** Lúc ZBook chết đột ngột, mdviewer gián đoạn vài phút: pod và MySQL dời sang Jerry sau khoảng 30 giây, cộng thời gian Longhorn gắn ổ và MySQL khởi động. Khi cần bảo trì ZBook thì chạy `kubectl drain` trước. Chi tiết trong note "06 - Test failover".
- **Token để autodeploy đọc GHCR và báo status** nằm trong Secret `apps/autodeploy-github`. Token hết hạn thì deploy ngừng: job `verify` chờ 25 phút rồi đỏ. Cách tạo lại có trong note "05 - CI/CD".
- **Pipeline cũ đã gỡ hết**: pm2, `~/apps/mdviewer`, self-hosted runner, tunnel "home". `.env.production.example` giờ chỉ còn là danh sách biến.
