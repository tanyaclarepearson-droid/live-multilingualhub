// Places & scales overlays proportionally to the stage width
export function fitOverlays(spec) {
  const stage = document.getElementById('stage');
  const root = document.getElementById('overlays');
  root.innerHTML = '';

  const W = stage.getBoundingClientRect().width;

  spec.forEach(item => {
    const img = document.createElement('img');
    img.className = 'overlay';
    img.id = `ov-${item.id}`;
    img.src = item.src;

    // size relative to stage width
    const wPx = ((item.size?.wPct ?? 10) / 100) * W;
    img.style.width = `${wPx}px`;

    // position from center using % of stage box
    img.style.left = `${item.center.xPct}%`;
    img.style.top  = `${item.center.yPct}%`;

    if (item.hotspot) img.classList.add('hotspot');
    root.appendChild(img);
  });
}
