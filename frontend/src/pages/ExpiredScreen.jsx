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

  const waLink = info?.contact_phone
    ? `https://wa.me/91${info.contact_phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hisab Kitab plan upgrade ke liye contact kar raha/rahi hun — ${info.restaurant_name || ''}`)}`
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
          <p className="text-[11px] text-ledger-inkSoft mt-2">
            Payment ke baad apni receipt WhatsApp karein — hum aapka plan upgrade kar denge.
          </p>
        </div>
      )}

      {/* Contact button — always shown if we have a phone, below UPI or as fallback */}
      {waLink && (
        <a href={waLink} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full max-w-xs py-3 rounded-xl border-2 border-green-500 text-green-600 font-bold text-sm mb-4">
          <svg className="w-5 h-5 fill-green-500" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp Par Contact Karein
        </a>
      )}

      {!canPay && !waLink && info && (
        <p className="text-xs text-ledger-inkSoft mb-6">Upgrade ke liye humse contact karein.</p>
      )}

      <button onClick={logout} className="text-sm text-ledger-red font-semibold underline">Logout</button>
    </div>
  );
}
