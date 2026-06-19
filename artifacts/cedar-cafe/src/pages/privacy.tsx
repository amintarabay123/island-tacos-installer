export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 7, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Who we are</h2>
        <p>Cedar Cafe ("we", "us", "our") operates an online ordering and in-store point-of-sale system for our restaurant located at Road Town, British Virgin Islands. This privacy policy explains how we collect, use, and protect your personal information.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Information we collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Name and contact details</strong> — provided when you place an order (name, phone number, email address).</li>
          <li><strong>Order information</strong> — items ordered, total amount, payment method, and order status.</li>
          <li><strong>Device and usage data</strong> — standard server logs (IP address, browser type, pages visited) for security and diagnostics.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. How we use your information</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>To process and fulfill your order.</li>
          <li>To send you order confirmation and status updates via email, SMS, or WhatsApp.</li>
          <li>To respond to inquiries sent through our WhatsApp business number.</li>
          <li>To improve our service and diagnose technical issues.</li>
        </ul>
        <p className="mt-3">We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. WhatsApp messaging</h2>
        <p>If you contact us via WhatsApp or provide a phone number at checkout, we may send you order notifications and respond to your messages through the WhatsApp Business API. Message frequency depends on your orders. Standard messaging rates may apply. You can opt out at any time by replying <strong>STOP</strong> or contacting us directly.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Data retention</h2>
        <p>Order records are retained for up to 3 years for accounting and operational purposes. You may request deletion of your personal data by contacting us at the details below.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Security</h2>
        <p>We use industry-standard security practices to protect your data. Our systems are hosted on secure cloud infrastructure. No method of transmission over the internet is 100% secure, but we take reasonable steps to protect your information.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Your rights</h2>
        <p>You have the right to access, correct, or request deletion of your personal information. To exercise these rights, contact us at:</p>
        <div className="mt-3 pl-4 border-l-2 border-gray-200">
          <p><strong>Cedar Cafe</strong></p>
          <p>Road Town, British Virgin Islands</p>
          <p>Phone: (284) 344-9808</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Changes to this policy</h2>
        <p>We may update this policy from time to time. Changes will be posted at this URL with an updated date.</p>
      </section>
    </div>
  );
}
