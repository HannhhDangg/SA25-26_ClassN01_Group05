import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Mở cửa cho Docker (0.0.0.0)
    port: 3000, // Ép chạy cổng 3000 (Thay vì 5173)
    strictPort: true, // Nếu cổng 3000 bận thì báo lỗi luôn chứ không đổi cổng khác
    watch: {
      usePolling: true, // Bắt buộc cho Docker trên Windows để sửa code tự cập nhật
    },
    proxy: {
      "/api": {
        target: "http://nginx:80",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://nginx:80",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
