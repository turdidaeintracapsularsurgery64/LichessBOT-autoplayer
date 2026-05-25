const DEFAULTS = {
  enabled: true,
  botDelayMs: 150
};

function $(id) { return document.getElementById(id); }

async function loadSettings() {
  const stored = await chrome.storage.local.get(['enabled', 'botDelayMs']);
  return {
    enabled: stored.enabled ?? DEFAULTS.enabled,
    botDelayMs: stored.botDelayMs ?? DEFAULTS.botDelayMs
  };
}

async function saveSettings(next) {
  await chrome.storage.local.set(next);
}

(async function init() {
  const toggleBtn = $('toggle');
  const speedSel = $('speed');

  const s = await loadSettings();
  toggleBtn.classList.toggle('on', s.enabled);
  toggleBtn.textContent = s.enabled ? 'Enabled' : 'Disabled';
  speedSel.value = String(s.botDelayMs);

  toggleBtn.addEventListener('click', async () => {
    const current = await loadSettings();
    const next = { enabled: !current.enabled, botDelayMs: current.botDelayMs };
    await saveSettings(next);
    toggleBtn.classList.toggle('on', next.enabled);
    toggleBtn.textContent = next.enabled ? 'Enabled' : 'Disabled';
  });

  speedSel.addEventListener('change', async () => {
    const current = await loadSettings();
    await saveSettings({ enabled: current.enabled, botDelayMs: Number(speedSel.value) });
  });
})();

