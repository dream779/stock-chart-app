interface DcaStatusBadgeProps {
  frequency: 'daily' | 'weekly' | 'monthly';
}

const FREQ_LABEL = {
  daily: '每日定投',
  weekly: '每周定投',
  monthly: '每月定投',
};

export default function DcaStatusBadge({ frequency }: DcaStatusBadgeProps) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 w-fit">
      {FREQ_LABEL[frequency]}
    </span>
  );
}
