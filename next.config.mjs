/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "replicate.delivery",
      },
      {
        protocol: "https",
        hostname: "canva-clone-ali.vercel.app",
      },
    ],
  },
  webpack: (config) => {        
    // See https://webpack.js.org/configuration/resolve/#resolvealias
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-web/all": path.join(__dirname, 'node_modules/onnxruntime-web/dist/ort.all.bundle.min.mjs'),
    }
    return config;
  },
};

export default nextConfig;
