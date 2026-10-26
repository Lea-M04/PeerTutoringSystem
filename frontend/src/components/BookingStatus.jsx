const labels = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export default function BookingStatus({ status }) {
  const label = labels[status] || 'Unknown status';

  return <span className={`application-status booking-status status-${status || 'unknown'}`}>{label}</span>;
}
