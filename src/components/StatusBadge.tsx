import type { RequestStatus } from "@prisma/client";

const LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  ordered: "Ordered",
  received: "Received",
  rejected: "Rejected",
};

const CLASS: Record<RequestStatus, string> = {
  pending: "badge badge-pending",
  ordered: "badge badge-ordered",
  received: "badge badge-received",
  rejected: "badge badge-rejected",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={CLASS[status]}>{LABEL[status]}</span>;
}

export function OverdueBadge() {
  return <span className="badge badge-overdue">Overdue</span>;
}
