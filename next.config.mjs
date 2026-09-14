/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["playwright", "@prisma/client"],
};

export default nextConfig;
