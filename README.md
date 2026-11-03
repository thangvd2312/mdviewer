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

### Trợ lý AI

Trợ lý gọi bất kỳ endpoint nào tương thích OpenAI Chat Completions. Điền vào `backend/.env`: `ASSISTANT_BASE_URL` (vd. `https://9router.tidesquare.vn/v1`), `ASSISTANT_API_KEY`, `ASSISTANT_MODEL` (mặc định `cx/gpt-6.1-sol`) và `ASSISTANT_EFFORT` (reasoning effort cho câu trả lời: `low`/`medium`/`high`, mặc định `high`; gợi ý câu hỏi luôn dùng `low` cho nhanh), rồi khởi động lại backend. Để trống `ASSISTANT_API_KEY` thì trợ lý bị tắt (nút vẫn hiện nhưng báo chưa cấu hình).

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
- **Sticky notes**: bôi đen một đoạn bất kỳ trong tài liệu → chọn màu trên thanh công cụ để ghim note. 6 loại, mỗi loại một màu giấy: Note (vàng), Important (đỏ), Idea (xanh lá), Question (tím), To-do (cam), Definition (xanh dương). Đoạn được ghim sẽ được tô màu, có marker ở lề phải; bấm vào đoạn hoặc marker để mở/sửa note, đổi loại, xoá. Danh sách note (lọc theo loại) nằm ở cột phải hoặc nút *Notes* trên thanh trên. Note gắn theo nội dung text nên vẫn đúng chỗ khi sửa tài liệu; nếu đoạn text bị xoá, note vẫn còn trong danh sách với nhãn "text no longer in document".
- **Trợ lý AI**: nút nổi kiểu AssistiveTouch, kéo thả được và tự bám mép màn hình. Trợ lý biết bạn đang ở trang nào, đang đọc mục nào và các sticky note của tài liệu, nên gợi ý câu hỏi theo đúng mục đang đọc. Bôi đen một đoạn rồi bấm *Ask* (hoặc ✨ trong note) để hỏi riêng về đoạn đó. Câu trả lời stream trực tiếp; mỗi tài liệu / project có cuộc trò chuyện riêng.
  - **Model dự phòng**: nếu model đang dùng lỗi hoặc hết quota trước khi kịp trả lời chữ nào, server tự thử lần lượt `ASSISTANT_FALLBACK_MODELS` (mặc định Claude Opus 5.5 xhigh → Gemini 4 Argon → MiniMax M3). Người dùng không thấy lỗi. Đoạn `<think>…</think>` mà MiniMax chèn vào câu trả lời được lọc bỏ. Model thực sự trả lời được ghi vào `assistant_messages.model` và `assistant_usage.model`.
  - **Giới hạn để không hết quota**:
    - Mỗi người mỗi ngày được 30 câu với model chính (`ASSISTANT_MODEL`), sau đó tự chuyển sang model rẻ `ASSISTANT_SAVER_MODEL` (mặc định `cx/gpt-6-luna`) thêm 50 câu, rồi dừng đến 0h (giờ Việt Nam). Panel hiện số câu còn lại, nhãn *Saver*, và báo giờ mở lại khi hết lượt.
    - Mỗi người chỉ có 1 câu đang được trả lời tại một thời điểm, tối đa 5 câu/phút. Câu bị Stop vẫn tính lượt; câu lỗi không tính.
    - Trần token toàn hệ thống mỗi ngày (`ASSISTANT_GLOBAL_DAILY_TOKENS`): dùng quá 70% thì mọi người chuyển sang model rẻ, hết 100% thì tạm dừng đến 0h. Trần này chặn được việc tạo nhiều tài khoản để lách giới hạn.
    - Câu trả lời dài quá `ASSISTANT_MAX_ANSWER_CHARS` bị cắt (router bỏ qua `max_completion_tokens`).
    - Tài liệu dài hơn 60.000 ký tự chỉ gửi mục lục + mục đang đọc.
    - Gợi ý câu hỏi luôn dùng model rẻ, được cache 30 phút.
    - `ASSISTANT_UNLIMITED_USERS` (GitHub login/email) không bị giới hạn theo người.
    - Mọi lần gọi AI được ghi vào bảng `assistant_usage` (model, tier, token, ngày). Đổi các con số trong `.env` trên server rồi `pm2 reload mdviewer`; danh sách biến xem `backend/.env.example`.
  - **Lưu lịch sử**: mọi câu hỏi và câu trả lời được lưu trong bảng `assistant_conversations` / `assistant_messages` (kèm tài liệu, mục đang đọc, đoạn trích, thời gian, model; câu trả lời bị dừng giữa chừng có `status = 'stopped'`). Mở lại trợ lý sẽ tiếp tục cuộc trò chuyện gần nhất; *New chat* bắt đầu cuộc mới nhưng cuộc cũ vẫn giữ, xem lại ở nút *Past chats*. Xoá tài liệu/project thì lịch sử vẫn còn (chỉ bỏ liên kết).
- **Mobile**: bôi đen text thì thanh màu hiện ở đáy màn hình (không đè lên menu chọn text của hệ điều hành); sticky note và trợ lý mở dạng bottom sheet, luôn nằm trên bàn phím ảo; nút to vừa ngón tay; ô nhập 16px để iOS không tự zoom.
- Light / dark / theo hệ thống. Có giao diện cho mobile, sidebar thu gọn được.

### Blog: tài liệu public và bình luận

- **Blog công khai** (không cần đăng nhập; người chưa đăng nhập vào `/` sẽ tới thẳng blog):
  - `/blog` — bài mới nhất nổi bật, danh sách bài (tìm kiếm, *Latest* / *Most read*), cột bên có *Most read* và *Topics*; `/blog?topic=<chủ đề>` lọc theo chủ đề.
  - `/blog/<slug>` — bài viết, khung tác giả + *More from…*, bình luận.
  - `/u/<login>` — trang tác giả: số bài, lượt xem, các bài đã đăng.
  - Người đã đăng nhập dùng cùng giao diện blog, có thêm nút *My notes* và trợ lý AI. Link cũ `/explore` và `/s/<slug>` được chuyển hướng 301 sang link mới.
- **Publish**: trong tài liệu bấm **Share** → bật *Public on the web*. Slug lấy từ tiêu đề (bỏ dấu) kèm 6 ký tự ngẫu nhiên; gỡ public rồi public lại vẫn giữ link cũ. Mỗi bài tự có mô tả (đoạn văn mở đầu), chủ đề (các tiêu đề `##`, bỏ số thứ tự) và thời gian đọc, tính lại mỗi lần lưu. Sticky note và lịch sử chat AI luôn riêng tư.
- **Link preview**: server chèn `<title>` và thẻ Open Graph cho `/blog`, `/blog/<slug>` và `/u/<login>`, nên dán link vào Messenger/Zalo/Slack hiện tiêu đề và mô tả.
- **Bình luận** (trả lời 1 cấp): người đăng nhập bình luận bằng tên GitHub; người chưa đăng nhập bình luận ẩn danh (tên tuỳ chọn). Mỗi bình luận lưu IP (lấy từ `CF-Connecting-IP` của Cloudflare Tunnel) và thiết bị; không bao giờ hiện công khai, có dòng thông báo cho người bình luận. Khách sửa/xoá được bình luận của mình trong 24 giờ (bí mật lưu trong trình duyệt, server chỉ giữ hash). Bình luận mới nhất lên đầu, tải 20 luồng mỗi lần, mỗi luồng 10 câu trả lời đầu + *Show more replies*.
- **Chống spam**: khách tối đa 5 bình luận/10 phút và 30/ngày theo IP, người đăng nhập 10/100 theo tài khoản (giới hạn trong bộ nhớ, xoá bình luận không được trả lại lượt; sửa bình luận cũng tính); chặn bình luận trùng nội dung trong 24 giờ; bẫy bot (ô ẩn + gửi quá nhanh); tối đa 2 link (khách) / 5 link (người đăng nhập); chỉ nhận JSON và đúng `Origin` để trang web khác không thể bắt trình duyệt người dùng gửi bình luận hộ.
- **Kiểm duyệt** (chủ bài, ngay trên trang public): ẩn/hiện, xoá, chặn người bình luận (theo tài khoản; khách theo IP — không ảnh hưởng người đã đăng nhập dùng chung mạng), tắt bình luận cho từng bài. Danh sách người bị chặn và nút *Unblock* nằm trong hộp thoại Share. Chặn theo IP tự hết hạn sau 180 ngày.
- **Lưu giữ dữ liệu**: sau `COMMENT_IP_RETENTION_DAYS` ngày (mặc định 90) IP và user agent của bình luận bị xoá (chỉ giữ nhãn thiết bị ngắn như "iPhone · Safari").
- Người đọc **đã đăng nhập** hỏi được trợ lý AI về bài public của người khác (không thấy sticky note hay project của tác giả).

### Kết nối AI agent (MCP)

viewmd có sẵn một MCP server (streamable HTTP) tại `https://<site>/api/mcp`, để Claude Code, Codex, Cursor… lưu và tra cứu ghi chú của bạn. Ví dụ: *"Lưu những gì vừa tìm hiểu về Redis vào viewmd, project Backend"*.

1. Trong app bấm biểu tượng robot ở góc dưới sidebar (**Connect an AI agent**) → tạo token (chỉ hiện một lần; server chỉ lưu hash; thu hồi được bất cứ lúc nào).
2. Thêm vào agent:
   - Claude Code: `claude mcp add --transport http viewmd https://<site>/api/mcp --header "Authorization: Bearer <token>"`
   - Codex: `export VIEWMD_TOKEN=<token>` rồi `codex mcp add viewmd --url https://<site>/api/mcp --bearer-token-env-var VIEWMD_TOKEN`
   - Client khác: `{"mcpServers":{"viewmd":{"url":"https://<site>/api/mcp","headers":{"Authorization":"Bearer <token>"}}}}`
3. Tool: `save_note` (có thể kèm tên project — chưa có thì tạo), `append_to_note`, `update_note`, `search_notes`, `read_note`, `list_recent_notes`, `list_projects`. Agent **không** xoá hay publish được gì. Mỗi token chỉ thấy ghi chú của chủ token; giới hạn 60 lần ghi / 10 phút và 300 request / 5 phút mỗi token.

### Phím tắt

| Phím | Tác dụng |
| --- | --- |
| ⌘K / Ctrl+K | Tìm kiếm |
| E | Sửa tài liệu đang xem |
| ⌘S / Ctrl+S | Lưu và tiếp tục sửa |
| ⌘↵ | Lưu nội dung đã paste ở trang chủ / đóng sticky note |
| N | Ghim note cho đoạn đang bôi đen |
| ⌘J / Ctrl+J | Mở / đóng trợ lý |

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
| GET / POST | `/api/docs/:id/annotations` | Sticky notes của doc. POST: `{ quote, prefix?, suffix?, position?, kind?, body? }` |
| PATCH / DELETE | `/api/annotations/:id` | PATCH: `{ kind?, body? }` |
| GET | `/api/assistant/status` | `{ enabled, model, quota }`: hạn mức hôm nay của người dùng (`next`: `full`/`saver`/`null`, số câu đã dùng, `resetAt`) |
| POST | `/api/assistant/suggest` | `{ context, selection? }` → `{ questions }` |
| POST | `/api/assistant/chat` | `{ conversationId?, message: { content, quote?, section? }, context, retry? }`, trả về Server-Sent Events (`conversation` kèm `tier` / `text` / `done` / `error`). Câu hỏi và câu trả lời đều được lưu vào DB. `429` khi vượt giới hạn |
| GET | `/api/assistant/conversations` | `?page=&docId=&projectId=&limit=` → các cuộc trò chuyện đã lưu, mới nhất trước |
| GET | `/api/assistant/conversations/:id` | Cuộc trò chuyện kèm toàn bộ tin nhắn |
| PUT | `/api/docs/:id/sharing` | `{ public?, allowComments? }` — publish / gỡ public, bật/tắt bình luận |
| GET | `/api/public/docs` | Bài trên blog: `?q=&sort=latest\|popular&author=&topic=&offset=&limit=` (không cần đăng nhập) |
| GET | `/api/public/authors/:login` | Trang tác giả: tên, avatar, số bài, tổng lượt xem |
| GET | `/api/public/topics` | Các chủ đề phổ biến trên blog |
| GET | `/api/public/docs/:slug` | Bài public (không cần đăng nhập) |
| GET | `/api/public/docs/:slug/comments` | 20 luồng bình luận mới nhất, `?before=<nextCursor>` để tải thêm |
| GET | `/api/public/comments/:id/replies` | Thêm câu trả lời, `?after=<moreReplies>` |
| POST | `/api/public/docs/:slug/comments` | `{ body, parentId?, guestName?, elapsedMs }` — khách nhận `guestToken` |
| PATCH / DELETE | `/api/public/comments/:id` | Sửa / xoá (tác giả; khách gửi `X-Guest-Token`; chủ bài xoá được mọi bình luận) |
| PUT | `/api/public/comments/:id/hidden` | Chủ bài ẩn/hiện `{ hidden }` |
| POST / DELETE | `/api/public/comments/:id/block` | Chủ bài chặn / bỏ chặn người viết bình luận |
| GET / DELETE | `/api/public/blocks`, `/api/public/blocks/:id` | Danh sách người bị chặn / bỏ chặn |
| GET / POST / DELETE | `/api/tokens`, `/api/tokens/:id` | Token cho AI agent: liệt kê / tạo `{ name }` (trả token một lần) / thu hồi |
| POST | `/api/mcp` | MCP server (streamable HTTP), `Authorization: Bearer <token>` |

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
- **Key của trợ lý AI**: lưu trong GitHub secret `ASSISTANT_API_KEY` (repo public nên không để trong code). Mỗi lần deploy, workflow ghi `ASSISTANT_API_KEY`, `ASSISTANT_BASE_URL` (biến `vars.ASSISTANT_BASE_URL`, mặc định router 9router) và `ASSISTANT_UNLIMITED_USERS` (biến `vars.ASSISTANT_UNLIMITED_USERS`, mặc định `thangvd2312`) vào `.env` trên server. Đổi key: `gh secret set ASSISTANT_API_KEY` rồi chạy lại workflow.
- **Database**: migration (`backend/src/migrations`) tự chạy mỗi khi app khởi động (`DB_MIGRATIONS_RUN=true`). Khi đổi entity thì tạo migration mới:
  ```bash
  cd backend && DB_NAME=<db trống hoặc khớp schema hiện tại> npm run migration:generate -- src/migrations/<TenMigration>
  ```
- **Xem log / khởi động lại**: `pm2 logs mdviewer`, `pm2 restart mdviewer`.
