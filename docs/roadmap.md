# Novel Reader — Roadmap

## Vision

Xây dựng web đọc novel chất lượng cao, hướng đến cộng đồng đọc novel. Hiện tại focus Shadow Slave, thiết kế mở để hỗ trợ nhiều truyện trong tương lai.

---

## Phase 1: Core UX ← đang làm

> Spec chi tiết: `docs/superpowers/specs/2026-05-15-phase1-core-ux-design.md`

Mục tiêu: biến trang web từ "bảng danh sách chapters" thành trải nghiệm đọc truyện thực sự.

| # | Feature | Mô tả |
|---|---------|-------|
| 1 | **Minimal header** | Ảnh bìa nhỏ + tên truyện + tác giả + tổng chapters + nút "Continue Reading" |
| 2 | **Reading progress** | Lưu chapter đang đọc vào localStorage, hiển thị ở header |
| 3 | **Keyboard navigation** | ← → chuyển chapter khi đọc |
| 4 | **Scroll to top** | Tự scroll lên đầu khi chuyển chapter |
| 5 | **Dark mode toggle** | Toàn trang (nav, list, reader), lưu preference vào localStorage |

Không cần thay đổi backend/API. Chỉ frontend + localStorage.

---

## Phase 2: Thu hút người dùng

> Spec chi tiết: viết khi bắt đầu Phase 2

Mục tiêu: cải thiện trải nghiệm trên mobile, tăng khả năng chia sẻ và SEO.

| # | Feature | Mô tả |
|---|---------|-------|
| 1 | **Mobile responsive** | Chapter list dạng card trên mobile thay vì table. Reader tối ưu cho màn hình nhỏ |
| 2 | **Reading time estimate** | Hiển thị "~5 min read" cho mỗi chapter dựa trên word count |
| 3 | **Share button** | Nút copy link chapter để chia sẻ |
| 4 | **SEO meta tags** | Title, description, og:image cho mỗi trang — giúp link đẹp khi share lên social |
| 5 | **Infinite scroll** | Thay pagination cứng bằng load thêm khi scroll xuống cuối |

---

## Tương lai (chưa plan)

Các ý tưởng có thể làm sau Phase 2, chưa có timeline:

- **Account system** — đăng nhập để sync reading progress đa thiết bị
- **Multiple novels** — hỗ trợ nhiều truyện, trang chủ là danh sách novels
- **Full-text search** — tìm nội dung bên trong chapters
- **PWA** — cài như app trên điện thoại, hỗ trợ đọc offline
- **Comments** — thảo luận dưới mỗi chapter
- **Scheduled auto-sync** — tự crawl chapter mới theo lịch
