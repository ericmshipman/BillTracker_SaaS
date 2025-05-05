// Scripts/bubble.js

/**
 * Draws a 650×650 hand-drawn bubble with animated fluid inside.
 * @param {string|HTMLElement} containerSelector  CSS selector or element.
 * @param {number} fillPercent                  How “full” the fluid is (0–100).
 * @returns {{update: function(number)}}        Call update(pct) to change level.
 */
function createBubbleWithFluid(containerSelector, fillPercent = 50) {
    // accept either a selector string or an element
    const container = 
      typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;
    const NS = 'http://www.w3.org/2000/svg';
    const size = 300, cx = size/2, cy = size/2, r = size/2 - 1;
    const liquidColor = "white";
  
    // 1) SVG root
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.style.width = svg.style.height = '100%';
    svg.style.background = 'transparent';
    container.appendChild(svg);
  
    // 2) defs: gradients, filters, clipPath
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <radialGradient id="bubble-sheen" cx="30%" cy="30%" r="80%">
        <stop offset="0%"  stop-color="white" stop-opacity="0.6"/>
        <stop offset="80%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
      <filter id="roughen">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
      </filter>
      <radialGradient id="pastel-rainbow" cx="50%" cy="50%" r="75%">
        <stop offset="0%"  stop-color="#FFC1E3" stop-opacity="0.4"/>
        <stop offset="30%" stop-color="#C1E7FF" stop-opacity="0.4"/>
        <stop offset="60%" stop-color="#E3FFC1" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#FFD1B8" stop-opacity="0.4"/>
      </radialGradient>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" result="grain"/>
        <feColorMatrix in="grain" type="saturate" values="0" result="grainBW"/>
        <feBlend in="SourceGraphic" in2="grainBW" mode="multiply"/>
      </filter>
      <filter id="glare-blur">
        <feGaussianBlur stdDeviation="2"/>
      </filter>
      <clipPath id="clip-bubble">
        <circle cx="${cx}" cy="${cy}" r="${r}"/>
      </clipPath>
    `;
    svg.appendChild(defs);
  
    // 3) Fluid group (clipped to bubble)
    const fluidGroup = document.createElementNS(NS, 'g');
    fluidGroup.setAttribute('clip-path', 'url(#clip-bubble)');
    // 3a) base tint
    const fluidBase = document.createElementNS(NS, 'rect');
    fluidBase.setAttribute('x', 0);
    fluidBase.setAttribute('y', 0);
    fluidBase.setAttribute('width', size);
    fluidBase.setAttribute('height', size);
    fluidBase.setAttribute('fill', '#84c7e0');
    fluidBase.setAttribute('fill-opacity', '0.4');
    fluidGroup.appendChild(fluidBase);
    // 3b) moving wave
    const wave = document.createElementNS(NS, 'path');
    wave.setAttribute('class', 'wave');
    wave.setAttribute('fill', liquidColor);
    wave.setAttribute('fill-opacity', '0.8');
    fluidGroup.appendChild(wave);
    svg.appendChild(fluidGroup);
  
    // 4) Bubble outline + sheen (cartoon white outline + wobbly edge)
    const bubble = document.createElementNS(NS, 'circle');
    bubble.setAttribute('cx', cx);
    bubble.setAttribute('cy', cy);
    bubble.setAttribute('r', r);
    bubble.setAttribute('fill', 'url(#bubble-sheen)');
    // make the outline thick and white
    bubble.setAttribute('stroke', '#d3ebf5');
    bubble.setAttribute('stroke-width', '3');
    // preserve your hand-drawn wobble if you like, or comment out for a crisp edge
    //bubble.setAttribute('filter', 'url(#roughen)');
    // smooth joins on the circle
    bubble.setAttribute('stroke-linejoin', 'round');
    bubble.setAttribute('stroke-linecap', 'round');
    svg.appendChild(bubble);

    
  
    // 5) Iris layer (pastel rainbow + hue-shift)
    const iris = document.createElementNS(NS, 'circle');
    iris.setAttribute('cx', cx);
    iris.setAttribute('cy', cy);
    iris.setAttribute('r', r);
    iris.setAttribute('fill', 'url(#pastel-rainbow)');
    iris.setAttribute('class', 'iridescent');
    svg.appendChild(iris);
  
    // 6) Grain texture (inside bubble only)
    const grain = document.createElementNS(NS, 'circle');
    grain.setAttribute('cx', cx);
    grain.setAttribute('cy', cy);
    grain.setAttribute('r', r);
    grain.setAttribute('fill', 'white');
    grain.setAttribute('opacity', '0.03');
    grain.setAttribute('filter', 'url(#grain)');
    svg.appendChild(grain);
  
    // // 7) Glare highlights
    // const glare1 = document.createElementNS(NS, 'ellipse');
    // glare1.setAttribute('cx', size * 0.35);
    // glare1.setAttribute('cy', size * 0.35);
    // glare1.setAttribute('rx', size * 0.18);
    // glare1.setAttribute('ry', size * 0.05);
    // glare1.setAttribute('fill', 'white');
    // glare1.setAttribute('opacity', '0.4');
    // glare1.setAttribute('filter', 'url(#glare-blur)');
    // svg.appendChild(glare1);
  
    // const glare2 = document.createElementNS(NS, 'path');
    // glare2.setAttribute(
    //   'd',
    //   `M${size*0.65},${size*0.2}
    //    l8,20 l20,5 l-20,5 l-8,20 l-8,-20 l-20,-5 l20,-5 Z`
    // );
    // glare2.setAttribute('fill', 'white');
    // glare2.setAttribute('opacity', '0.3');
    // glare2.setAttribute('filter', 'url(#glare-blur)');
    // svg.appendChild(glare2);
  
    // 8) Wave builder + initial draw
    function buildWave(pct) {
      const waveHeight = 4;
      const fillY = size - (pct/100) * size;
      let d = `M 0 ${fillY}`;
      const waveLen = 600;
      for (let x = 0; x <= size + waveLen; x += 20) {
        const theta = (x / waveLen) * 2 * Math.PI;
        const y = fillY + Math.sin(theta) * waveHeight;
        d += ` L ${x} ${y}`;
      }
      d += ` L ${size+waveLen} ${size} L 0 ${size} Z`;
      return d;
    }
    wave.setAttribute('d', buildWave(fillPercent));
  
    return {
      update(newPct) {
        wave.setAttribute('d', buildWave(newPct));
      }
    };
  }
  