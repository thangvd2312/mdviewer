# viewmd

Đọc Markdown thật đẹp. Paste nội dung `.md` (từ AI chat, README, tài liệu thiết kế…), lưu lại và đọc như một trang tài liệu. Mỗi tài liệu có thể thuộc một **project** hoặc là một **note** đứng riêng.

```
viewmd/
├── docker-compose.yml   MySQL 8.4 (cổng 3307)
├── backend/             NestJS 12 + TypeORM + MySQL, xác thực JWT   → http://localhost:9000/api
└── frontend/            React 19 + Vite + Tailwind v4               → http://localhost:5173
```

## Chạy local

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env        # đổi JWT_SECRET, điền GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
npm install
npm run start:dev

# 3. Frontend (terminal khác)
cd frontend
npm install
npm run dev                 # proxy /api → localhost:9000
```

Mở http://localhost:5173, bấm **Continue with GitHub**, rồi bấm **Open sample** để xem các định dạng được hỗ trợ.

### Tạo GitHub OAuth App (làm một lần)

1. Vào https://github.com/settings/applications/new
2. Điền:
   - **Application name**: `viewmd (local)`
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/api/auth/github/callback`
3. Bấm *Register application*, rồi *Generate a new client secret*.
4. Chép Client ID và Client secret vào `backend/.env`:
   ```env
   GITHUB_CLIENT_ID=Ov23li...
   GITHUB_CLIENT_SECRET=...
   ```
5. Khởi động lại backend.

Khi deploy, tạo thêm một OAuth App khác với domain thật, rồi cập nhật `FRONTEND_URL` và `GITHUB_CALLBACK_URL`.

> `DB_SYNC=true` cho TypeORM tự tạo bảng từ entity, chỉ dùng cho môi trường dev. Khi lên production nên tắt và dùng migrations.

## Tính năng

- **Đăng nhập bằng GitHub** (OAuth, có kiểm tra `state` chống CSRF). Lần đầu đăng nhập sẽ tự tạo tài khoản. Nếu email GitHub đã xác minh trùng với một tài khoản cũ thì tự liên kết vào tài khoản đó.
- **Project**: gom các tài liệu liên quan, có icon, mô tả, import nhiều file `.md` một lần (kéo thả hoặc nút Import).
- **Notes**: tài liệu đứng riêng, không thuộc project nào. Có thể chuyển qua lại giữa project và note bất cứ lúc nào.
- **Paste nhanh** ở trang chủ: dán xong bấm *Save & view* (⌘↵) để lưu ngay, hoặc *Edit first* để chỉnh trước khi lưu.
- **Editor** có 3 chế độ Write / Split / Preview, xem trước trực tiếp, kéo thả file, Tab thụt lề, ⌘S để lưu, cảnh báo khi rời trang mà chưa lưu.
- **Trang đọc** theo kiểu tài liệu:
  - GFM: bảng, task list, footnote, gạch ngang.
  - Code block dạng card, có tô màu cú pháp, nút copy và wrap.
  - Sơ đồ Mermaid (chỉ tải khi tài liệu có sơ đồ).
  - Mục lục "On this page" tự highlight theo vị trí cuộn, anchor cho từng heading, thông tin số từ và thời gian đọc.
- Tiêu đề tự lấy từ heading đầu tiên nếu không nhập.
- **Tìm kiếm** ⌘K theo tiêu đề và nội dung. **Recents** sắp theo lần mở gần nhất.
- Copy Markdown, tải file `.md`, xoá tài liệu hoặc project (xoá project sẽ xoá kèm toàn bộ tài liệu bên trong).
- Light / dark / theo hệ thống. Có giao diện cho mobile, sidebar thu gọn được.

### Phím tắt

| Phím | Tác dụng |
| --- | --- |
| ⌘K / Ctrl+K | Tìm kiếm |
| E | Sửa tài liệu đang xem |
| ⌘S / Ctrl+S | Lưu và tiếp tục sửa |
| ⌘↵ | Lưu nội dung đã paste ở trang chủ |

## API

Tất cả route (trừ `auth/github*`) cần header `Authorization: Bearer <token>`. Mỗi người dùng chỉ thấy được dữ liệu của chính mình.

| Method | Path | Ghi chú |
| --- | --- | --- |
| GET | `/api/auth/github` | Chuyển hướng sang GitHub để đăng nhập |
| GET | `/api/auth/github/callback` | GitHub gọi về, sau đó chuyển tới `FRONTEND_URL/auth/callback#token=…` |
| GET | `/api/auth/me` | |
| GET / POST | `/api/projects` | `{ name, description?, icon? }` |
| PATCH / DELETE | `/api/projects/:id` | Xoá project sẽ xoá kèm các doc bên trong |
| GET | `/api/docs` | `?projectId=` `?scope=loose` `?q=` `?sort=recent\|updated\|title` `?limit=`, chỉ trả về bản tóm tắt (không có `content`) |
| POST | `/api/docs` | `{ content, title?, projectId? }`, title để trống thì lấy từ heading |
| GET | `/api/docs/:id` | Trả về đầy đủ và cập nhật `lastOpenedAt` |
| PATCH / DELETE | `/api/docs/:id` | `projectId: null` để chuyển thành note |

Nội dung tối đa khoảng 2 triệu ký tự (body JSON giới hạn 5 MB).

## Deploy (production)

Production chạy tại **https://mdviewer.thangvu.io.vn**:

```
Cloudflare (HTTPS) ── cloudflared tunnel ──► 127.0.0.1:4100  pm2 "mdviewer" (NestJS: /api + React build)
                                                    │
                                                    └──► 127.0.0.1:3307  MySQL (container kiwi-mysql, database mdviewer)
```

- **CI/CD** (`.github/workflows/deploy.yml`): mỗi lần push hoặc mở PR sẽ chạy typecheck, lint và build trên runner của GitHub. Riêng push lên `main` thì sẽ deploy thêm qua self-hosted runner trên server (label `mdviewer`): rsync code vào `~/apps/mdviewer`, `npm run install:all`, `npm run build`, `pm2 startOrReload`, rồi gọi `/api/health` để kiểm tra.
- **Cấu hình server**: file `~/apps/mdviewer/.env` (xem mẫu ở `.env.production.example`). File này không được commit và rsync cũng không ghi đè lên nó.
- **Database**: migration (`backend/src/migrations`) tự chạy mỗi khi app khởi động (`DB_MIGRATIONS_RUN=true`). Khi đổi entity thì tạo migration mới:
  ```bash
  cd backend && DB_NAME=<db trống hoặc khớp schema hiện tại> npm run migration:generate -- src/migrations/<TenMigration>
  ```
- **Xem log / khởi động lại**: `pm2 logs mdviewer`, `pm2 restart mdviewer`.
