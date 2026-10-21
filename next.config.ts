 import type { NextConfig } from "next";

const nextConfig: NextConfig = {
images: {
remotePatterns: [
{
protocol: "https",
hostname: "res.cloudinary.com",
pathname: "/**",
},
{
protocol: "https",
hostname: "placehold.co",
pathname: "/**",
},
],
},

typescript: {
ignoreBuildErrors: true,
},
};

export default nextConfig;
