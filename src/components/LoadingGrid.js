export default function LoadingGrid({
  count = 12,
  label = '正在加载精彩内容...',
}) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-status">
        <span className="loading-orbit" aria-hidden="true">
          <span />
        </span>
        <div>
          <strong>{label}</strong>
          <span>好内容正在赶来的路上</span>
        </div>
      </div>

      <div className="skeleton-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className="skeleton-card" key={index} style={{ '--skeleton-index': index }}>
            <div className="skeleton-poster" />
            <div className="skeleton-line skeleton-line-title" />
            <div className="skeleton-line skeleton-line-meta" />
          </div>
        ))}
      </div>
    </div>
  );
}
