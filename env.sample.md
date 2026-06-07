# Biến môi trường — Thiên Nga Store

Tạo file `.env` / `.env.local` thủ công (không commit). Giá trị thật lấy từ team hoặc cloud console.

## Storefront (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8888/api
NEXT_PUBLIC_MEDIA_BASE_URL=https://your-cdn.cloudfront.net
```

## Backend (`backend/.env`)

```env
PORT=8888
CORS_ORIGIN=http://localhost:3000,http://localhost:8080

MONGODB_URI=mongodb+srv://USER:PASSWORD@YOUR_CLUSTER.mongodb.net/thiennga?retryWrites=true&w=majority

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
S3_CDN_BASE_URL=https://your-cdn.cloudfront.net
S3_PUBLIC_BASE_URL=https://your-cdn.cloudfront.net
S3_UPLOAD_PREFIX=store

UPLOAD_MAX_BYTES=5242880
UPLOAD_ALLOWED_MIME=image/jpeg,image/png,image/webp
S3_PRESIGN_EXPIRES_IN=300
```

## CMS (`cms/.env`)

```env
VITE_API_URL=http://localhost:8888/api
VITE_MEDIA_BASE_URL=https://your-cdn.cloudfront.net
```

## S3 / IAM (gợi ý)

| Biến | Mô tả |
|------|--------|
| `AWS_REGION` | Region bucket (vd. `us-east-1`) |
| `S3_BUCKET_NAME` | Tên bucket |
| `S3_UPLOAD_PREFIX` | Prefix upload (vd. `store`) |
| `S3_PUBLIC_BASE_URL` | CDN/public URL cho link ảnh |

Ảnh upload (ví dụ):  
`{S3_PUBLIC_BASE_URL}/{S3_UPLOAD_PREFIX}/products/ten-file.jpg`

IAM policy resource (gợi ý):

- `arn:aws:s3:::YOUR_BUCKET`
- `arn:aws:s3:::YOUR_BUCKET/store/*`

Trong `backend/.env` điền `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (IAM user), **không** commit.

## CORS bucket (CMS upload từ browser)

Allowed origins: `http://localhost:8080`, domain CMS production.

## Local ports

| App | URL |
|-----|-----|
| API | http://localhost:8888/api |
| CMS | http://localhost:8080 |
| Store | http://localhost:3000 |
