(function () {
    const STORAGE_KEY = 'emotionart-settings';
    const VALID_MODEL_CLASSIFIERS = new Set(['base', 'large']);
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

    function normalizeSettings(rawSettings) {
        const settings = { ...DEFAULT_SETTINGS, ...(rawSettings || {}) };
        if (!VALID_MODEL_CLASSIFIERS.has(settings.model_classifier)) {
            settings.model_classifier = DEFAULT_SETTINGS.model_classifier;
        }
        return settings;
    }

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
            return normalizeSettings(filtered);
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function writeStoredSettings(settings) {
        const normalized = normalizeSettings(settings);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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
        return normalizeSettings(settings);
    }

    function syncStatus(message, tone) {
        const status = document.getElementById('settings-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.tone = tone || 'neutral';
    }

    function getModelStatusElements() {
        return {
            panel: document.getElementById('model-download-panel'),
            title: document.getElementById('model-download-title'),
            state: document.getElementById('model-download-state'),
            copy: document.getElementById('model-download-copy'),
            loading: document.getElementById('model-download-loading'),
        };
    }

    function syncModelStatus(status) {
        const { panel, title, state, copy, loading } = getModelStatusElements();
        if (!panel || !state || !copy || !title || !loading) return;

        const nextState = status?.state || 'idle';
        panel.hidden = false;
        panel.dataset.state = nextState;
        title.textContent = 'Large Model Download';
        state.dataset.state = nextState;
        state.textContent = nextState;
        loading.hidden = nextState !== 'loading';

        if (nextState === 'loading') {
            copy.textContent = 'Large model is downloading. The download is 1.42GB and is rate limited. This can take around 10-15 minutes.';
            return;
        }

        if (nextState === 'ready') {
            copy.textContent = 'Large model is ready to use.';
            return;
        }

        if (nextState === 'error') {
            copy.textContent = status.details || 'Large model could not be prepared. Check the server console for more detail.';
            return;
        }

        copy.textContent = 'Large model download has not started.';
    }

    async function fetchModelStatus() {
        const response = await fetch('/api/settings/model-status?model=large');
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Unable to read model status');
        }
        syncModelStatus(payload);
        return payload;
    }

    async function startLargeModelPreload() {
        const response = await fetch('/api/settings/model-preload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'large' }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Unable to start large model loading');
        }
        syncModelStatus(payload);
        return payload;
    }

    function bootSettingsPage() {
        const form = document.getElementById('settings-form');
        if (!form) return;

        const storedSettings = readStoredSettings();
        populateForm(form, storedSettings);
        writeStoredSettings(storedSettings);

        const saveButton = document.getElementById('save-settings');
        const resetButton = document.getElementById('restore-settings');
        const clearMetadataButton = document.getElementById('clear-metadata');
        const clearGalleryButton = document.getElementById('clear-gallery');
        const modelSelector = form.elements.namedItem('model_classifier');
        let modelStatusPoll = null;

        function stopModelPolling() {
            if (modelStatusPoll) {
                window.clearInterval(modelStatusPoll);
                modelStatusPoll = null;
            }
        }

        async function refreshModelStatus() {
            try {
                const payload = await fetchModelStatus();
                if (payload.state === 'ready' || payload.state === 'error' || payload.state === 'idle') {
                    stopModelPolling();
                }
            } catch (error) {
                syncModelStatus({ state: 'error', details: error.message || 'Unable to read model status.' });
                stopModelPolling();
            }
        }

        function ensureModelPolling() {
            stopModelPolling();
            modelStatusPoll = window.setInterval(refreshModelStatus, 3000);
        }

        if (modelSelector) {
            if (modelSelector.value !== 'large') {
                fetchModelStatus().catch(() => {
                    syncModelStatus({ state: 'idle' });
                });
            }

            modelSelector.addEventListener('change', async () => {
                if (modelSelector.value === 'large') {
                    window.alert('Large Model may take a while to download and prepare the first time you select it.');
                    syncModelStatus({ state: 'loading' });
                    try {
                        await startLargeModelPreload();
                        ensureModelPolling();
                    } catch (error) {
                        syncModelStatus({ state: 'error', details: error.message || 'Unable to start large model loading.' });
                    }
                    return;
                }

                stopModelPolling();
                try {
                    await fetchModelStatus();
                } catch (error) {
                    syncModelStatus({ state: 'idle' });
                }
            });
        }

        if (storedSettings.model_classifier === 'large') {
            syncModelStatus({ state: 'loading' });
            refreshModelStatus();
            ensureModelPolling();
        } else {
            fetchModelStatus().catch(() => {
                syncModelStatus({ state: 'idle' });
            });
        }

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
            stopModelPolling();
            syncStatus('Defaults restored', 'neutral');
            fetchModelStatus().catch(() => {
                syncModelStatus({ state: 'idle' });
            });
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
