const STYLES = {
  paid: { color: '#4F7942', label: 'PAID', rotate: '-4deg' },
  cash: { color: '#4F7942', label: 'CASH', rotate: '-4deg' },
  upi: { color: '#4F7942', label: 'UPI', rotate: '-3deg' },
  unpaid: { color: '#5C4F44', label: 'OPEN', rotate: '3deg' },
  partial: { color: '#B8862E', label: 'PARTIAL', rotate: '-2deg' },
  credit: { color: '#C0571F', label: 'KHATA', rotate: '3deg' },
};

// A small badge styled like a rubber ink stamp - the app's signature visual
// motif, echoing the stamps used on paper bills and ledger receipts.
export default function StampBadge({ status, size = 'sm' }) {
  const s = STYLES[status] || STYLES.unpaid;
  const sizeClasses = size === 'lg' ? 'text-sm px-3 py-1' : 'text-[11px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center justify-center font-display font-semibold uppercase tracking-wider rounded-sm border-2 ${sizeClasses}`}
      style={{
        color: s.color,
        borderColor: s.color,
        transform: `rotate(${s.rotate})`,
        backgroundColor: `${s.color}14`,
      }}
    >
      {s.label}
    </span>
  );
}
