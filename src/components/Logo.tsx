 // src/components/Logo.tsx
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      {/* ✅ Responsive Icon Size: w-8 h-8 on mobile, w-10 h-10 on desktop */}
      <div className="relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-green-600 rounded-lg md:rounded-xl shadow-sm group-hover:scale-105 transition-transform">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="w-5 h-5 md:w-6 md:h-6 text-white"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
      
      {/* ✅ Responsive Text Size: text-lg on mobile, text-2xl on desktop */}
      <span className="text-lg md:text-2xl font-extrabold tracking-tight text-gray-900">
        i<span className="text-green-600">BUY</span>
      </span>
    </Link>
  );
}