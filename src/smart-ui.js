const OVERRIDE_KEY = 'luvvy-smart-engine';
const options = [
  ['smart', 'Smart · Auto choose best method'],
  ['general', 'General · BRIA RMBG 2.0'],
  ['anime', 'Anime · IS-Net Anime'],
  ['flat', 'Flat background · Edge-aware solver'],
  ['fast', 'Fast · IMG.LY IS-Net'],
];

function smartifySelect(select) {
  if (!select || select.dataset.smartified) return;
  select.dataset.smartified = '1';
  const selected = localStorage.getItem(OVERRIDE_KEY) || 'smart';
  select.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  select.value = selected;
  select.addEventListener('change', (event) => {
    const value = event.target.value;
    localStorage.setItem(OVERRIDE_KEY, value);
    localStorage.setItem('luvvy-engine', value === 'fast' ? 'fast' : 'quality');
  }, true);

  const row = select.closest('.select-row');
  const title = row?.querySelector('span');
  const help = row?.querySelector('small');
  if (title) title.textContent = 'Automatic cutout engine';
  if (help) help.textContent = 'Smart is default. It analyzes the image and can choose a general model, anime model, or edge-aware flat background solver.';
}

function apply() {
  smartifySelect(document.querySelector('#landingEngine'));
  smartifySelect(document.querySelector('#engineMode'));
}

new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
queueMicrotask(apply);
