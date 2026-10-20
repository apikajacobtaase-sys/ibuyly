 import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export default function Logo({
  width = 220,
  height = 120,
  className = "",
  priority = false,
}: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="iBuyly homepage"
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/ibuyly-logo.jpeg"
        alt="iBuyly — Shop Daily"
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-auto max-w-full object-contain"
        style={{
          width: `${width}px`,
          height: "auto",
          maxHeight: `${height}px`,
        }}
      />
    </Link>
  );
}