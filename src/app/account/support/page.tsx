"use client";
import AccountSubPageLayout from "@/components/AccountSubPageLayout";
import { HelpCircle, MessageCircle, Phone, Mail } from "lucide-react";

export default function SupportPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "233000000000";
  
  return (
    <AccountSubPageLayout title="Help & Support">
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Contact Us</h3>
          <div className="space-y-3">
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors">
              <Phone className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Chat on WhatsApp</span>
            </a>
            <a href="mailto:support@ibuy.com" className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
              <Mail className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Email Support</span>
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {["How do I track my order?", "What is your return policy?", "How do I become a seller?"].map((faq) => (
              <button key={faq} className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <span className="text-sm text-gray-700">{faq}</span>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </AccountSubPageLayout>
  );
}