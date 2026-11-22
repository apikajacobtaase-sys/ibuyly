 import Link from "next/link";
 import { Mail, MapPin, Phone } from "lucide-react";
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-950 text-gray-300">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div>
            <Link href="/" className="text-2xl font-extrabold text-white">
              iBUY <span className="text-green-500">AFRICA</span>
            </Link>

            <p className="mt-4 text-sm leading-6 text-gray-400">
              Inclusive Business Universe for You.
              <br />
              Verified Deals, Delivered Everywhere.
            </p>

            <p className="mt-4 text-sm leading-6 text-gray-400">
              Democratizing e-commerce by connecting credible African
              businesses with customers everywhere.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="mb-4 font-bold text-white">Explore</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/products" className="hover:text-green-400">Shop Products</Link></li>
              <li><Link href="/categories" className="hover:text-green-400">Categories</Link></li>
              <li><Link href="/about" className="hover:text-green-400">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-green-400">Contact Us</Link></li>
            </ul>
          </div>

          {/* Customer Support */}
          <div>
            <h3 className="mb-4 font-bold text-white">Customer Support</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/terms" className="hover:text-green-400">Terms & Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-green-400">Privacy Policy</Link></li>
              <li><Link href="/returns-policy" className="hover:text-green-400">Returns & Refunds</Link></li>
              <li><Link href="/shipping-policy" className="hover:text-green-400">Shipping & Delivery</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 font-bold text-white">Get in Touch</h3>

            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <Phone className="mt-1 h-4 w-4 text-green-500" />
                <a href="tel:+233541726820" className="hover:text-green-400">
                  +233 54 172 6820
                </a>
              </li>

              <li className="flex items-start gap-3">
                <Mail className="mt-1 h-4 w-4 text-green-500" />
                <a href="mailto:ibuysupportghana@gmail.com" className="break-all hover:text-green-400">
                  ibuysupportghana@gmail.com
                </a>
              </li>

              <li className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 text-green-500" />
                <span>
                  iBUY Africa Pickup Station,
                  Near Goo Junior High School,
                  Zorkor, Bolgatanga,
                  Upper East Region, Ghana.
                </span>
              </li>
            </ul>

            <a
              href="https://wa.me/233541726820"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white transition hover:bg-green-700"
            >
              Chat with us on WhatsApp
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col gap-4 border-t border-gray-800 pt-6 text-center text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} iBUY Africa. All rights reserved.</p>
          <p>Serving customers across all 16 regions of Ghana.</p>
        </div>
      </div>
    </footer>
  );
}