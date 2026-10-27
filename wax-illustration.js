(() => {
  document.querySelectorAll('.wax-storyboard').forEach(story => {
    const buttons = [...story.querySelectorAll('[data-wax-select]')];
    const playback = story.querySelector('[data-wax-playback]');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stages = [{name: 'fresh', duration: 3500}, {name: 'glide', duration: 9000}, {name: 'worn', duration: 4500}];
    let index = stages.findIndex(stage => stage.name === story.dataset.waxStage);
    let remaining = stages[index].duration;
    let playing = !motion.matches;
    let visible = false;
    let timer = null;
    let started = 0;

    function suspend() {
      if (timer !== null) {
        remaining = Math.max(0, remaining - (performance.now() - started));
        clearTimeout(timer);
        timer = null;
      }
    }

    function select(next) {
      index = next;
      remaining = stages[index].duration;
      story.dataset.waxStage = stages[index].name;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.waxSelect === stages[index].name)));
    }

    function update() {
      suspend();
      const running = playing && visible && !document.hidden;
      story.dataset.waxRunning = String(running);
      playback.textContent = playing ? 'Ⅱ Pauzeren' : '▶ Afspelen';
      playback.setAttribute('aria-label', playing ? 'Animatie pauzeren' : 'Animatie afspelen');
      if (running) {
        started = performance.now();
        timer = setTimeout(() => {
          timer = null;
          select((index + 1) % stages.length);
          update();
        }, remaining);
      }
    }

    buttons.forEach(button => button.addEventListener('click', () => {
      suspend();
      playing = false;
      select(stages.findIndex(stage => stage.name === button.dataset.waxSelect));
      update();
    }));
    playback.addEventListener('click', () => { playing = !playing; update(); });
    motion.addEventListener('change', event => { playing = !event.matches; update(); });
    document.addEventListener('visibilitychange', update);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        update();
      }, {threshold: 0});
      observer.observe(story.querySelector('figure'));
    } else {
      visible = true;
    }
    playback.hidden = false;
    update();
  });
})();
