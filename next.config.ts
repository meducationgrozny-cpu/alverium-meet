import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Отключаем назойливую кнопку "N" в левом нижнем углу
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
};

export default nextConfig;
