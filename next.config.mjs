/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["konva", "react-konva"],
  output: "standalone",
};

export default nextConfig;
