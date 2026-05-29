# Sử dụng Node.js bản nhẹ
FROM node:18-alpine

# Tạo thư mục làm việc
WORKDIR /app

# Copy file khai báo thư viện trước (để tận dụng cache của Docker)
COPY package.json ./

# Cài đặt thư viện
RUN npm install

# Copy toàn bộ code vào
COPY . .

# # folder uploads ảnh
# RUN mkdir -p uploads && chmod 777 uploads

# Mở port 3000
EXPOSE 3000

# Chạy server
CMD ["npm", "start"]