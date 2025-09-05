// Simple hotspot wiring (click to navigate or run a handler)
export function mountHotspots(spec) {
  spec.filter(i => i.hotspot).forEach(i => {
    const el = document.getElementById(`ov-${i.id}`);
    if (!el) return;

    const hs = i.hotspot;
    el.title = hs.title ?? '';

    if (hs.href) {
      el.addEventListener('click', () => {
        if (hs.target === '_blank') window.open(hs.href, '_blank');
        else location.href = hs.href;
      });
    } else if (hs.action) {
      el.addEventListener('click', () => {
        console.log('hotspot action:', hs.action);
      });
    }

    el.tabIndex = 0;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') el.click();
    });
  });
}
