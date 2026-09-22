'use client';
export default function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modalbg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">{children}</div>
    </div>
  );
}
