/**
 * Gallery Save — shared utility used by every art theme page.
 *
 * Provides a single async function `saveArtwork(options)` that wires up the
 * "Save" button in the overlay panel. When clicked it:
 *   1. Captures the current canvas as a base64 PNG data-URL (via options.captureImage)
 *   2. Gathers the current transcript text and emotion scores
 *   3. Reads the user's filename pattern from settings (localStorage)
 *   4. POSTs everything to /api/gallery/save on the Flask server
 *   5. Shows a brief "SAVED" confirmation, then re-enables the button
 *
 * Usage (from each theme's app controller):
 *   saveArtwork({
 *       pageName:     'flow_field',                    // internal page identifier
 *       captureImage: () => canvas.toDataURL('image/png'),  // returns base64 data-URL
 *       getEmotions:  () => lastEmotions,              // returns the emotion array
 *       getTranscript: () => lastTranscriptText,       // returns the transcript string
 *   });
 */
async function saveArtwork(options) {
    const saveButton = document.getElementById('save-output');
    if (!saveButton || !options || typeof options.captureImage !== 'function') return;

    saveButton.addEventListener('click', async () => {
        // Prevent double-clicks while saving
        if (saveButton.disabled) return;

        saveButton.disabled = true;
        saveButton.textContent = 'SAVING';

        try {
            // Capture the artwork canvas as a base64 PNG data-URL
            const imageData = options.captureImage();

            // Gather transcript — prefer the callback, fall back to DOM element
            const transcriptEl = document.getElementById('transcript');
            const transcriptText = typeof options.getTranscript === 'function'
                ? options.getTranscript()
                : (transcriptEl ? transcriptEl.textContent.trim() : '');

            // Gather emotion scores (array of {label, score} objects)
            const emotions = typeof options.getEmotions === 'function' ? options.getEmotions() : [];

            // Read the user's filename pattern from localStorage via settings.js
            const settings = window.getEmotionArtSettings ? window.getEmotionArtSettings() : null;

            // POST to the Flask gallery save endpoint
            const response = await fetch('/api/gallery/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    page_name: options.pageName,
                    image_data: imageData,
                    transcript: transcriptText,
                    emotions,
                    filename_pattern: settings?.saving_filename_pattern,
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Save failed.');
            }

            // Brief success feedback before re-enabling the button
            saveButton.textContent = 'SAVED';
            window.setTimeout(() => {
                saveButton.textContent = 'SAVE';
                saveButton.disabled = false;
            }, 1200);
        } catch (error) {
            window.alert(error.message || 'Save failed.');
            saveButton.textContent = 'SAVE';
            saveButton.disabled = false;
        }
    });
}
