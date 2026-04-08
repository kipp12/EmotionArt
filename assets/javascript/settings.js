(function () {
    const STORAGE_KEY = 'emotionart-settings';
    const DEFAULT_SETTINGS = {
        appearance_theme: 'light',
        appearance_density: 'comfortable',
        appearance_retro: 'default',
        accessibility_large_text: false,
        accessibility_reduced_motion: false,
        accessibility_focus_visibility: false,
        audio_default_mic: 'manual',
        audio_transcript_persistence: 'keep',
        model_classifier: 'base',
        saving_format: 'png',
        saving_filename_pattern: 'MY [PAGE_NAME] ART [NUMBER]',
    };

    function readStoredSettings() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...DEFAULT_SETTINGS };
            const parsed = JSON.parse(raw);
            const filtered = Object.fromEntries(
                Object.keys(DEFAULT_SETTINGS)
                    .filter(key => Object.prototype.hasOwnProperty.call(parsed, key))
                    .map(key => [key, parsed[key]])
            );
            return { ...DEFAULT_SETTINGS, ...filtered };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function writeStoredSettings(settings) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function applySettings(settings) {
        const root = document.documentElement;
        root.dataset.appTheme = settings.appearance_theme;
        root.dataset.appDensity = settings.appearance_density;
        root.dataset.appRetro = settings.appearance_retro;
        root.dataset.largeText = String(!!settings.accessibility_large_text);
        root.dataset.highContrast = 'false';
        root.dataset.reducedMotion = String(!!settings.accessibility_reduced_motion);
        root.dataset.focusVisibility = String(!!settings.accessibility_focus_visibility);
        window.EmotionArtSettings = settings;
    }

    function populateForm(form, settings) {
        Object.entries(settings).forEach(([key, value]) => {
            const field = form.elements.namedItem(key);
            if (!field) return;
            if (field.type === 'checkbox') {
                field.checked = !!value;
            } else {
                field.value = value;
            }
        });
    }

    function readForm(form) {
        const settings = { ...DEFAULT_SETTINGS };
        Object.keys(DEFAULT_SETTINGS).forEach(key => {
            const field = form.elements.namedItem(key);
            if (!field) return;
            settings[key] = field.type === 'checkbox' ? field.checked : field.value;
        });
        return settings;
    }

    function syncStatus(message, tone) {
        const status = document.getElementById('settings-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.tone = tone || 'neutral';
    }

    function bootSettingsPage() {
        const form = document.getElementById('settings-form');
        if (!form) return;

        populateForm(form, readStoredSettings());

        const saveButton = document.getElementById('save-settings');
        const resetButton = document.getElementById('restore-settings');
        const clearMetadataButton = document.getElementById('clear-metadata');
        const clearGalleryButton = document.getElementById('clear-gallery');

        saveButton?.addEventListener('click', event => {
            event.preventDefault();
            const settings = readForm(form);
            writeStoredSettings(settings);
            applySettings(settings);
            syncStatus('Settings saved', 'success');
        });

        resetButton?.addEventListener('click', event => {
            event.preventDefault();
            writeStoredSettings(DEFAULT_SETTINGS);
            populateForm(form, DEFAULT_SETTINGS);
            applySettings(DEFAULT_SETTINGS);
            syncStatus('Defaults restored', 'neutral');
        });

        clearMetadataButton?.addEventListener('click', async event => {
            event.preventDefault();
            if (!window.confirm('Clear saved transcripts, emotion scores, and favourite flags?')) return;
            const response = await fetch('/api/settings/clear-metadata', { method: 'POST' });
            const payload = await response.json();
            syncStatus(response.ok ? 'Saved metadata cleared' : (payload.error || 'Unable to clear metadata'), response.ok ? 'success' : 'error');
        });

        clearGalleryButton?.addEventListener('click', async event => {
            event.preventDefault();
            if (!window.confirm('Delete every saved gallery image and metadata file?')) return;
            const response = await fetch('/api/settings/clear-gallery', { method: 'POST' });
            const payload = await response.json();
            syncStatus(response.ok ? 'Gallery cleared' : (payload.error || 'Unable to clear gallery'), response.ok ? 'success' : 'error');
        });
    }

    const initialSettings = readStoredSettings();
    applySettings(initialSettings);

    document.addEventListener('DOMContentLoaded', () => {
        bootSettingsPage();
    });

    window.getEmotionArtSettings = function () {
        return readStoredSettings();
    };
})();
