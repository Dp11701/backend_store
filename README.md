# Thiên Nga API (NestJS + MongoDB)

## Cấu hình

1. Tạo `backend/.env` theo `env.sample.md` ở repo root (không commit `.env`).
2. URI nên có tên database: `...mongodb.net/thiennga?retryWrites=true&w=majority`

### Lỗi `MongooseServerSelectionError` / IP whitelist (Atlas)

API không khởi động xong cho đến khi MongoDB kết nối được.

1. [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access** → **Add IP Address** → **Add Current IP Address** (hoặc `0.0.0.0/0` chỉ khi dev).
2. Đợi ~1 phút, kiểm tra user/password trong `MONGODB_URI` khớp **Database Access**.
3. Hoặc chạy MongoDB local: `MONGODB_URI=mongodb://127.0.0.1:27017/thiennga` rồi `pnpm seed`.

## Chạy

```bash
pnpm install
pnpm dev          # http://localhost:8888/api
pnpm seed         # nạp categories, products, vouchers
```

## Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/health` | Health check |
| POST | `/api/seed?force=true` | Seed DB |
| GET | `/api/products` | Danh sách SP (`?category=&search=&isNew=&isSale=`) |
| GET | `/api/products/slug/:slug` | Chi tiết theo slug |
| GET | `/api/categories` | Danh mục |
| GET | `/api/vouchers` | Mã giảm giá active |
| GET | `/api/vouchers/:code` | Validate voucher |
| POST/PATCH/DELETE | `/api/admin/products` | CMS CRUD |
| GET | `/api/admin/categories` | Danh sách danh mục (CMS) |
| POST/PATCH/DELETE | `/api/admin/categories` | CMS CRUD |
| POST/PATCH/DELETE | `/api/admin/vouchers` | CMS CRUD |
| GET | `/api/admin/uploads/status` | S3 đã cấu hình? |
| POST | `/api/admin/uploads` | Upload ảnh (`multipart`: `file`, `folder`) |

Upload ảnh: `folder` = `products` \| `categories` \| `misc` → file lưu tại `s3://{bucket}/{S3_UPLOAD_PREFIX}/{folder}/...`

### Upload S3 — IAM & lỗi thường gặp

Bucket: `phund-853516498568-us-east-1-an`, prefix: `store/` (file → `store/products/...`).

**1. IAM user** (user đang gắn Access Key trong `backend/.env`):

- [IAM Console](https://console.aws.amazon.com/iam/) → **Users** → chọn đúng user → **Add permissions** → **Create inline policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UploadUnderStorePrefix",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::phund-853516498568-us-east-1-an/store/*"
    },
    {
      "Sid": "ListStorePrefixOptional",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::phund-853516498568-us-east-1-an",
      "Condition": {
        "StringLike": { "s3:prefix": ["store", "store/*"] }
      }
    }
  ]
}
```

- Đặt tên policy (vd. `ThienNgaS3Upload`) → **Create policy**.
- API chỉ cần `s3:PutObject` trên `store/*`; `ListBucket` chỉ để xem file trên console.

**2. Kiểm tra**

- Access Key phải thuộc **cùng IAM user** vừa gắn policy (không dùng key user khác).
- `AWS_REGION=us-east-1` khớp region bucket.
- Restart API sau khi đổi `.env`.

**3. URL công khai qua CloudFront**

Upload **ghi** S3 (`store/...`). Link trả về CMS/storefront lấy từ `S3_PUBLIC_BASE_URL` (CDN):

`https://d3vtqt24fe9cqo.cloudfront.net/store/products/ten-file.jpg`

CloudFront origin trỏ bucket `phund-853516498568-us-east-1-an` (path object giữ nguyên `store/...`). Sau khi đổi `.env`, restart API.

**Lỗi `InvalidAccessKeyId`:** key/secret sai hoặc secret còn giá trị mẫu `EXAMPLEKEY` trong `.env`.

**Lỗi `AccessDenied` khi upload:** IAM user thiếu policy trên — làm bước 1.

Giỏ hàng vẫn xử lý **phía client** (Zustand + localStorage). API cung cấp dữ liệu sản phẩm đồng bộ.

**CMS:** `pnpm dev:cms` → http://localhost:8080
