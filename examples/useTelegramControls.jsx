import { useEffect } from 'react';

// Load https://telegram.org/js/telegram-web-app.js in production index.html first.
// Keep onAction/onBack stable with useCallback. Render an HTML CTA only outside TG.
export function useTelegramControls({ label, disabled, onAction, onBack }) {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return; // Browser preview is not an authenticated session.
    let running = false;
    let disposed = false;
    const syncTheme = () => {
      const css = document.documentElement.style;
      const dark = tg.colorScheme === 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const pairs = {
        '--app-bg': tg.themeParams.bg_color || (dark ? '#17161e' : '#f6f6f8'),
        '--app-text': tg.themeParams.text_color || (dark ? '#f7f5fc' : '#14131a'),
        '--app-muted': tg.themeParams.hint_color || (dark ? '#aaa5ba' : '#6c6978'),
        '--app-surface': tg.themeParams.secondary_bg_color || (dark ? '#22212c' : '#ffffff'),
      };
      Object.entries(pairs).forEach(([key, value]) => css.setProperty(key, value));
      const nativeButtonColor = tg.themeParams.button_color || '#4b32df';
      const nativeButtonText = tg.themeParams.button_text_color || '#ffffff';
      tg.MainButton.setParams({ color: nativeButtonColor, text_color: nativeButtonText });
    };
    const click = async () => {
      if (disabled || running) return;
      running = true;
      tg.MainButton.disable();
      tg.MainButton.showProgress();
      if (tg.isVersionAtLeast('6.1')) tg.HapticFeedback.selectionChanged();
      try { await onAction(); }
      // The screen's onAction must catch and show API errors, retaining the draft.
      finally {
        running = false;
        if (!disposed) {
          tg.MainButton.hideProgress();
          if (!disabled) tg.MainButton.enable();
        }
      }
    };
    tg.ready();
    tg.expand();
    syncTheme();
    tg.onEvent('themeChanged', syncTheme);
    tg.MainButton.setParams({ text: label, is_visible: true, is_active: !disabled });
    tg.MainButton.onClick(click);
    if (onBack && tg.isVersionAtLeast('6.1')) {
      tg.BackButton.show();
      tg.BackButton.onClick(onBack);
    } else tg.BackButton.hide();
    return () => {
      disposed = true;
      tg.offEvent('themeChanged', syncTheme);
      tg.MainButton.offClick(click);
      tg.MainButton.hideProgress();
      tg.MainButton.hide();
      if (onBack) tg.BackButton.offClick(onBack);
      tg.BackButton.hide();
    };
  }, [label, disabled, onAction, onBack]);
}

export async function exchangeTelegramSession() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) throw new Error('Open this app from its Telegram bot');
  const response = await fetch('/api/auth/telegram', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  if (!response.ok) throw new Error('Session expired. Reopen the Mini App.');
  return response.json();
}
