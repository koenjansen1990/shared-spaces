import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function PaywallScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8 flex flex-col items-center text-center gap-6">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
          🔒
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Upgrade to Pro</h1>
          <p className="text-sm text-gray-500">
            You&apos;re on the free plan, which includes 1 space. Upgrade to create unlimited spaces.
          </p>
        </div>

        {/* Feature list */}
        <ul className="w-full space-y-2 text-left">
          {['Unlimited spaces', 'Unlimited members', 'Priority support'].map(feature => (
            <li key={feature} className="flex items-center gap-3 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="w-full flex flex-col gap-3">
          <a href="mailto:hello@sharedspaces.app" className="w-full">
            <Button variant="primary" size="lg" className="w-full">Get in touch</Button>
          </a>
          <Link href="/dashboard" className="w-full">
            <Button variant="secondary" size="lg" className="w-full">← Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
