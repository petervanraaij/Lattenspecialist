(() => {
  document.querySelectorAll('.wax-storyboard').forEach(story => {
    const buttons = [...story.querySelectorAll('[data-wax-select]')];
    buttons.forEach(button => button.addEventListener('click', () => {
      story.dataset.waxStage = button.dataset.waxSelect;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    }));
  });
})();
