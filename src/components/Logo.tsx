 import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link
      href="/"
      aria-label="iBUY Africa Home"
      className="group flex shrink-0 items-center"
    >
      <Image
        src="/brand/ibuy-africa-logo.png"
        alt="iBUY Africa"
        width={1280}
        height={511}
        priority
        className="h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02] sm:h-12 md:h-14"
      />
    </Link>
  );
}