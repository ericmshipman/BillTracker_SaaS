const themeUrls = {
    bootstrap: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    cerulean:   'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/cerulean/bootstrap.min.css',
    cosmo:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/cosmo/bootstrap.min.css',
    cyborg:     'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/cyborg/bootstrap.min.css',
    darkly:     'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/darkly/bootstrap.min.css',
    flatly:     'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/flatly/bootstrap.min.css',
    journal:    'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/journal/bootstrap.min.css',
    litera:     'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/litera/bootstrap.min.css',
    lumen:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/lumen/bootstrap.min.css',
    lux:        'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/lux/bootstrap.min.css',
    materia:    'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/materia/bootstrap.min.css',
    minty:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/minty/bootstrap.min.css',
    morph:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/morph/bootstrap.min.css',
    pulse:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/pulse/bootstrap.min.css',
    quartz:     'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/quartz/bootstrap.min.css',
    sandstone:  'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/sandstone/bootstrap.min.css',
    simplex:    'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/simplex/bootstrap.min.css',
    sketchy:    'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/sketchy/bootstrap.min.css',
    slate:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/slate/bootstrap.min.css',
    solar:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/solar/bootstrap.min.css',
    spacelab:   'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/spacelab/bootstrap.min.css',
    superhero:  'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/superhero/bootstrap.min.css',
    vapor:      'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/vapor/bootstrap.min.css',
    zephyr:     'https://cdn.jsdelivr.net/npm/bootswatch@5.3.5/dist/zephyr/bootstrap.min.css'
  };

async function applySavedTheme() {
    let theme = localStorage.getItem('bt-theme');
  
    const { data: { user } } = await supabaseClient.auth.getUser();
    theme = user?.user_metadata.theme || theme;
  
    if (!theme || !(theme in themeUrls)) {
      theme = 'bootstrap';
    }
  
    const link = document.getElementById('themeStylesheet');
    if (link) link.href = themeUrls[theme];
  }

// window.applySavedTheme = applySavedTheme;