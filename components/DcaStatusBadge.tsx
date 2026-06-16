interface DcaStatusBadgeProps {
  frequency: 'daily' | 'weekly' | 'monthly';
  pendingCount: number;
  pendingAmount: number;
}

const FREQ_LABEL = {
  daily: '每日定投',
  weekly: '每周定投',
  monthly: '每月定投',
};

export default function DcaStatusBadge({
  frequency,
  pendingCount,
  pendingAmount,
}: DcaStatusBadgeProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 w-fit">
        {FREQ_LABEL[frequency]}
      </span>
      {pendingCount > 0 && (
        <span className="text-xs text-gray-500">
          {pendingCount} 期待确认 · ¥{pendingAmount.toFixed(2)}
        </span>
      )}
    </div>
  );
}
