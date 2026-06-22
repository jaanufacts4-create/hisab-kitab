import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

// Shown instead of the whole app once a trial expires. If the admin has
// set their own UPI ID and an amount for this specific client, shows a
// ready-to-pay UPI request (deep link for mobile + QR fallback for
// desktop/scanning) — otherwise just a generic "contact us" message.
export default function ExpiredScreen() {
  const { logout } = useAuth();
  const [info, setInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    api.get('/restaurant/payment-info')
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo({}));
  }, []);

  const canPay = info && info.upi_id && info.amount;
  const upiLink = canPay
    ? `upi://pay?pa=${encodeURIComponent(info.upi_id)}&pn=${encodeURIComponent(info.payee_name || 'Hisab Kitab')}&am=${Number(info.amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent('Hisab Kitab upgrade - ' + (info.restaurant_name || ''))}`
    : null;

  useEffect(() => {
    if (upiLink) QRCode.toDataURL(upiLink, { width: 220, margin: 1 }).then(setQrDataUrl);
  }, [upiLink]);

  return (
    <div className="min-h-screen ledger-bg flex flex-col items-center justify-center px-6 text-center">
      <p className="text-2xl font-bold text-ledger-red mb-2">Trial Khatam Ho Gaya</p>
      <p className="text-sm text-ledger-inkSoft mb-6 max-w-sm">
        Aapka trial period khatam ho gaya hai. Continue karne ke liye plan upgrade karna hoga.
      </p>

      {canPay && (
        <div className="card p-5 w-full max-w-xs mb-6">
          <p className="text-xs text-ledger-inkSoft mb-1">Upgrade Amount</p>
          <p className="text-3xl font-bold text-ledger-red mb-4">{rupee(info.amount)}</p>

          {qrDataUrl && (
            <img src={qrDataUrl} alt="UPI QR" className="w-full mb-4 rounded-lg border border-gray-200" />
          )}

          <a href={upiLink}
            className="block w-full py-3 rounded-xl bg-ledger-red text-white font-bold text-sm shadow">
            📱 UPI App Se Pay Karein
          </a>
          <p className="text-[11px] text-ledger-inkSoft mt-3">
            Mobile par button dabane se UPI app khulega. Computer par upar wala QR scan karein.
          </p>
          <p className="text-[11px] text-ledger-inkSoft mt-3">
            Payment ke baad humein bata dein — hum aapka plan upgrade kar denge.
          </p>
        </div>
      )}

      {!canPay && info && (
        <p className="text-xs text-ledger-inkSoft mb-6">Upgrade ke liye humse contact karein.</p>
      )}

      <button onClick={logout} className="text-sm text-ledger-red font-semibold underline">Logout</button>
    </div>
  );
}
