# Handbook Backend API

Đây là dịch vụ Backend API chính của dự án **Handbook**, được xây dựng dựa trên Express.js, TypeScript và Node.js. Dự án đóng vai trò là **Single Source of Truth** về mặt dữ liệu, kết nối với MongoDB để quản lý trạng thái và sử dụng Redis Pub/Sub làm Event Broker để truyền thông tin sự kiện thời gian thực (realtime) tới `realtime-server`.

---

## 🛠️ Công nghệ & Thư viện sử dụng (Tech Stack)

- **Ngôn ngữ & Runtime**: Node.js (v20+), TypeScript, Express.js.
- **Cơ sở dữ liệu**: MongoDB (Mongoose ODM).
- **Caching & Broker**: Redis (ioredis), BullMQ (quản lý hàng đợi công việc nền).
- **Xác thực**: JWT (Access Token & Refresh Token), Custom Refresh Token Rotation, tích hợp Google OAuth.
- **AI Integration**: `@google/generative-ai` (Gemini API).
- **Mail Service**: Nodemailer & Resend API.
- **Bảo mật & Tiện ích**: Helmet, CORS, Express Rate Limit (Redis back-end), Morgan, Winston logger, Multer (upload file qua Cloudinary).
- **Giám sát**: Prometheus metrics (`prom-client`).

---

## 📂 Cấu trúc mã nguồn (Project Structure)

Mã nguồn được tổ chức theo cấu trúc phân lớp rõ ràng nhằm tối ưu hóa khả năng mở rộng:
```text
server-api/
├── src/
│   ├── common/         # Cấu hình chung, logger, các utils (database, redis...)
│   ├── controllers/    # Xử lý HTTP Request và trả về HTTP Response
│   ├── middlewares/    # Middleware xử lý auth, validation, rate-limiting, uploads...
│   ├── models/         # Khai báo schema Mongoose (MongoDB Models)
│   ├── repositories/   # Lớp trung gian thực hiện các truy vấn cơ sở dữ liệu
│   ├── routes/         # Định nghĩa routing các API endpoints
│   ├── services/       # Lớp xử lý logic nghiệp vụ chính (Business Logic)
│   ├── validations/    # Zod schemas để validate dữ liệu đầu vào của request
│   ├── app.ts          # Khởi tạo Express app và đăng ký các middleware toàn cục
│   └── server.ts       # Điểm khởi chạy Server & xử lý graceful shutdown
├── migration/          # Các script di cư dữ liệu qua các phiên bản
├── public/             # Tài nguyên tĩnh dùng chung
└── scripts/            # Các helper script hỗ trợ phát triển và vận hành
```

---

## 🚦 Danh sách API Endpoints chính

Tất cả các route được đăng ký dưới tiền tố `/api` (hoặc cấu hình tùy chỉnh):

- **`/auth`**: Đăng ký, đăng nhập, làm mới token (Refresh Token), tích hợp Google OAuth.
- **`/users` & `/follows` & `/friendships`**: Quản lý hồ sơ người dùng, theo dõi và thiết lập bạn bè.
- **`/posts` & `/comments` & `/categories`**: Viết bài, tương tác bài viết (like/reaction), bình luận và quản lý danh mục.
- **`/conversations` & `/messages`**: Tạo phòng trò chuyện (direct/group chat) và gửi tin nhắn.
- **`/notifications`**: Truy vấn và cập nhật trạng thái thông báo của người dùng.
- **`/groups` & `/items`**: Quản lý nhóm và các vật phẩm/danh mục liên quan.
- **`/uploads` & `/medias` & `/images`**: Upload hình ảnh, video, tài liệu lưu trữ thông qua Cloudinary.
- **`/handbook-ai`**: Tích hợp chatbot AI (sử dụng Gemini API) để phản hồi người dùng.

---

## ⚙️ Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
- **Node.js** v20.x trở lên.
- **MongoDB** và **Redis** đã hoạt động (có thể chạy nhanh qua Docker Compose của dự án gốc).

### 2. Thiết lập biến môi trường (`.env`)
Sao chép tệp cấu hình mẫu và điền đầy đủ các thông số:
```bash
cp .env.example .env
```
Các tham số cấu hình quan trọng:
- `MONGODB_URI`: URL kết nối tới MongoDB.
- `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Thông tin kết nối Redis.
- `JWT_SECRET` & `JWT_REFRESH_SECRET`: Khóa bí mật dùng để ký và xác thực mã JWT.
- `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET`: Tài khoản lưu trữ media Cloudinary.
- `AI_API_KEY`, `AI_MODEL`: API Key và cấu hình model của Google Generative AI (Gemini).
- `INTERNAL_SECRET_KEY`: Khóa bảo mật giao tiếp nội bộ giữa `server-api` và `realtime-server`.

### 3. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 4. Chạy ứng dụng trong môi trường phát triển (Dev)
```bash
npm run dev
```
API Server sẽ khởi động trên cổng được cấu hình (mặc định `8080` hoặc `3001` phụ thuộc vào `.env`).

### 5. Xây dựng bản phát hành và chạy Production
```bash
# Biên dịch mã nguồn TypeScript sang JavaScript
npm run build

# Khởi chạy ứng dụng production từ thư mục dist
npm start
```

---

## 🧪 Các câu lệnh bổ trợ (Scripts)

- **Kiểm tra cú pháp (Linting)**:
  ```bash
  npm run lint
  ```
- **Kiểm tra kiểu dữ liệu (Type checking)**:
  ```bash
  npm run typecheck
  ```
- **Chạy kiểm thử tự động (Jest)**:
  ```bash
  npm run test
  ```

---
*Lưu ý: Để đảm bảo kiến trúc hướng sự kiện hoạt động chính xác, mọi thay đổi dữ liệu (Write) phải đi qua REST API của `server-api` này để phát đi sự kiện Redis Pub/Sub đồng bộ tới `realtime-server`.*
