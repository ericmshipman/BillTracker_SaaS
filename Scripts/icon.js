(async function() {
    const resp = await fetch('Content/icons.svg');
    const text = await resp.text();
    const wrap = document.createElement('div');
    wrap.style.display = 'none';
    wrap.innerHTML = text;
    document.body.insertBefore(wrap, document.body.firstChild);
  })();