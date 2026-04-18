/**
 * Settings — global preferences manager (loaded on every page via _sidebar.html).
 *
 * Responsibilities:
 *   1. Persist user settings to localStorage under 'emotionart-settings'.
 *   2. Apply visual preferences (theme, density, retro font, accessibility)
 *      by setting data-* attributes on <html>, which the CSS in base.css reads.
 *   3. On the /settings page only: populate the form, handle save/reset,
 *      manage the large-model download panel, and expose gallery management buttons.
 *
 * Settings keys:
 *   appearance_theme         — 'light' | 'dark'
 *   appearance_density       — 'comfortable' | 'compact'
 *   appearance_retro         — 'default' | 'reduced'  (pixel font vs modern font)
 *   accessibility_large_text — boolean
 *   accessibility_reduced_motion — boolean
 *   accessibility_focus_visibility — boolean
 *   audio_default_mic        — 'manual' | 'auto'  (auto-start mic on page load)
 *   audio_transcript_persistence — 'keep' | 'clear'  (clear transcript after analysis)
 *   model_classifier         — 'base' | 'large'  (which HuggingFace model to use)
 *   saving_format            — 'png' (currently only PNG is supported)
 *   saving_filename_pattern  — template string e.g. 'MY [PAGE_NAME] ART [NUMBER]'
 *
 * Exposed globally:
 *   window.getEmotionArtSettings() — returns the current normalised settings object.
 *     Used by every theme's app controller to read model_classifier and audio prefs.
 */
(function () {
    // localStorage key where all settings are persisted as a JSON string.
    const STORAGE_KEY = 'emotionart-settings';

    // Whitelist of accepted model_classifier values.
    const VALID_MODEL_CLASSIFIERS = new Set(['base', 'large']);

    // Default settings — used on first visit or after a reset.
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

    /**
     * Merge raw settings with defaults, ensuring all keys exist
     * and the model_classifier value is valid.
     */
    function normalizeSettings(rawSettings) {
        const settings = { ...DEFAULT_SETTINGS, ...(rawSettings || {}) };
        if (!VALID_MODEL_CLASSIFIERS.has(settings.model_classifier)) {
            settings.model_classifier = DEFAULT_SETTINGS.model_classifier;
        }
        return settings;
    }

    /**
     * Read settings from localStorage, filter to only known keys,
     * and return a normalised copy. Returns defaults if nothing is stored.
     */
    function readStoredSettings() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...DEFAULT_SETTINGS };
            const parsed = JSON.parse(raw);
            // Only keep keys that exist in DEFAULT_SETTINGS (ignore stale keys)
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

    /**
     * Write normalised settings to localStorage.
     */
    function writeStoredSettings(settings) {
        const normalized = normalizeSettings(settings);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }

    /**
     * Apply visual settings by setting data-* attributes on <html>.
     * CSS rules in base.css use these attributes to switch themes, fonts,
     * motion, and text sizes without any JS DOM manipulation.
     */
    function applySettings(settings) {
        const root = document.documentElement;
        root.dataset.appTheme = settings.appearance_theme;
        root.dataset.appDensity = settings.appearance_density;
        root.dataset.appRetro = settings.appearance_retro;
        root.dataset.largeText = String(!!settings.accessibility_large_text);
        root.dataset.highContrast = 'false';
        root.dataset.reducedMotion = String(!!settings.accessibility_reduced_motion);
        root.dataset.focusVisibility = String(!!settings.accessibility_focus_visibility);
        // Also store on window so other scripts can access without reading localStorage
        window.EmotionArtSettings = settings;
    }

    /**
     * Populate the settings form fields from a settings object.
     * Handles both checkboxes (checked property) and other inputs (value property).
     */
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

    /**
     * Read the current form state back into a settings object.
     */
    function readForm(form) {
        const settings = { ...DEFAULT_SETTINGS };
        Object.keys(DEFAULT_SETTINGS).forEach(key => {
            const field = form.elements.namedItem(key);
            if (!field) return;
            settings[key] = field.type === 'checkbox' ? field.checked : field.value;
        });
        return normalizeSettings(settings);
    }

    /**
     * Show a status message (e.g. "Settings saved") on the settings page.
     */
    function syncStatus(message, tone) {
        const status = document.getElementById('settings-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.tone = tone || 'neutral';
    }

    // -----------------------------------------------------------------------
    // Large model download panel (settings page only)
    // -----------------------------------------------------------------------

    function getModelStatusElements() {
        return {
            panel: document.getElementById('model-download-panel'),
            title: document.getElementById('model-download-title'),
            state: document.getElementById('model-download-state'),
            copy: document.getElementById('model-download-copy'),
            loading: document.getElementById('model-download-loading'),
        };
    }

    /**
     * Update the model download panel UI based on the server's reported state.
     */
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
            copy.textContent = 'Large model is downloading. This can take around 10-15 minutes on a first time download.';
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

    /**
     * Fetch the large model's current state from the server.
     */
    async function fetchModelStatus() {
        const response = await fetch('/api/settings/model-status?model=large');
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Unable to read model status');
        }
        syncModelStatus(payload);
        return payload;
    }

    /**
     * Ask the server to start downloading the large model in the background.
     */
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

    // -----------------------------------------------------------------------
    // Settings page bootstrap (only runs if the settings form exists in the DOM)
    // -----------------------------------------------------------------------

    function bootSettingsPage() {
        const form = document.getElementById('settings-form');
        if (!form) return;

        // Populate form with stored values, then write them back (migration step
        // — ensures any new default keys are persisted on upgrade).
        const storedSettings = readStoredSettings();
        populateForm(form, storedSettings);
        writeStoredSettings(storedSettings);

        const saveButton = document.getElementById('save-settings');
        const resetButton = document.getElementById('restore-settings');
        const clearMetadataButton = document.getElementById('clear-metadata');
        const clearGalleryButton = document.getElementById('clear-gallery');
        const modelSelector = form.elements.namedItem('model_classifier');

        // Poll handle for checking large-model download progress.
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
                // Stop polling once the model reaches a terminal state.
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
            // Poll every 3 seconds until the download completes.
            modelStatusPoll = window.setInterval(refreshModelStatus, 3000);
        }

        // On load: check large-model status once (unless already selected as 'large').
        if (modelSelector) {
            if (modelSelector.value !== 'large') {
                fetchModelStatus().catch(() => {
                    syncModelStatus({ state: 'idle' });
                });
            }

            // When the user switches to the large model, trigger the download.
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

        // If the user already has 'large' selected, start polling immediately.
        if (storedSettings.model_classifier === 'large') {
            syncModelStatus({ state: 'loading' });
            refreshModelStatus();
            ensureModelPolling();
        } else {
            fetchModelStatus().catch(() => {
                syncModelStatus({ state: 'idle' });
            });
        }

        // Save button — persist current form state and apply visual changes.
        saveButton?.addEventListener('click', event => {
            event.preventDefault();
            const settings = readForm(form);
            writeStoredSettings(settings);
            applySettings(settings);
            syncStatus('Settings saved', 'success');
        });

        // Reset button — restore all settings to factory defaults.
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

        // Clear metadata — wipe transcripts/emotions/favourites but keep images.
        clearMetadataButton?.addEventListener('click', async event => {
            event.preventDefault();
            if (!window.confirm('Clear saved transcripts, emotion scores, and favourite flags?')) return;
            const response = await fetch('/api/settings/clear-metadata', { method: 'POST' });
            const payload = await response.json();
            syncStatus(response.ok ? 'Saved metadata cleared' : (payload.error || 'Unable to clear metadata'), response.ok ? 'success' : 'error');
        });

        // Clear gallery — delete everything (images + metadata).
        clearGalleryButton?.addEventListener('click', async event => {
            event.preventDefault();
            if (!window.confirm('Delete every saved gallery image and metadata file?')) return;
            const response = await fetch('/api/settings/clear-gallery', { method: 'POST' });
            const payload = await response.json();
            syncStatus(response.ok ? 'Gallery cleared' : (payload.error || 'Unable to clear gallery'), response.ok ? 'success' : 'error');
        });
    }

    // -----------------------------------------------------------------------
    // Immediate execution: apply stored settings on every page load
    // (runs before DOMContentLoaded so the theme is set before first paint).
    // -----------------------------------------------------------------------
    const initialSettings = readStoredSettings();
    applySettings(initialSettings);

    // Boot the settings page form (no-op if the form element doesn't exist).
    document.addEventListener('DOMContentLoaded', () => {
        bootSettingsPage();
    });

    // Expose a global getter so other scripts (theme app controllers, gallery-save)
    // can read the current settings without touching localStorage directly.
    window.getEmotionArtSettings = function () {
        return readStoredSettings();
    };
})();
