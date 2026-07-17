'use client';

/**
 * 播放页公告栏：防骗提醒 + 全站公告 + 私域引流 CTA
 */
export default function NoticeBar({ config, show, onClose }) {
  if (!show) return null;

  const pt = config?.private_traffic || {};
  const showPrivate = pt.enabled && (pt.message || pt.telegram_url || pt.group_url || pt.wechat_hint);
  const fraudTip = '防骗提醒：正在播放的视频中若出现任何广告水印，请务必提高警惕，切勿转账或参与，守护好您的财产安全！';

  return (
    <div className="broadcast-bar">
      <div className="broadcast-content">
        <span className="broadcast-icon">📢</span>
        <span>
          {config?.notice ? `${config.notice} ` : ''}
          {fraudTip}
          {showPrivate && (
            <>
              {' '}
              <strong>{pt.message || '防止走丢，更多福利资源请进群获取'}</strong>
              {pt.telegram_url && (
                <>
                  {' '}
                  <a href={pt.telegram_url} target="_blank" rel="noopener noreferrer" className="notice-cta">
                    电报群
                  </a>
                </>
              )}
              {pt.group_url && (
                <>
                  {' '}
                  <a href={pt.group_url} target="_blank" rel="noopener noreferrer" className="notice-cta">
                    加入社群
                  </a>
                </>
              )}
              {pt.wechat_hint && (
                <span className="notice-wechat"> 微信：{pt.wechat_hint}</span>
              )}
            </>
          )}
        </span>
      </div>
      <button className="broadcast-close-btn" onClick={onClose} title="关闭公告" type="button">
        &times;
      </button>
    </div>
  );
}
