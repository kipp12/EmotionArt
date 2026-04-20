```TO DEVELOPERS: There is a developer guide after the user guide! (not added yet)```

# EmotionArt User Guide
EmotionArt is an interactive procedural art generator that extracts emotion from typed or spoken transcripts to creates unique and fun artifacts. Users can choose from multiple visual themes and save/favourite their generated artwork. 

## Requirements
- Python 3.12 
- Internet access is required to install the requirements file and the language processing models.
- A windows laptop or computer. Please note this application is not appropriate for mobile screens. 

## Setup Instructions
- Step 1: Create a python virtual environment by running ```py -3.12 -m venv venv``` in command prompt or powershell.
- Step 2: Run your venv by running ```\venv\Scripts\Activate``` in command prompt or powershell.
- Step 3: Install pip (if you do not have it) by running ```-m pip install --upgrade pip``` in command prompt or powershell.
- Step 4: Install the requirements in the emotionart folder by running ```pip install -r requirements.txt``` in command prompt or powershell.
- Step 5: Once the requirements are installed, run the app by running ```python app.py```.
- Step 6: Open the app in a browser by pasting ```http://127.0.0.1:5000``` into URL bar.

## Getting Started
When you open EmotionArt, you are welcomed by the Themes page. This is where you choose the visual style you want to use.

The main navigation bar (LEFT) includes:

- Themes: choose an art style.
- Gallery: view all saved artwork.
- Favourites: view only favourite artwork.
- Settings: change app behavior and appearance.

## How To Use A Theme
Step 1: Go to Themes and click the one you want use.

Step 2: Enter your input. You can use:
- Text input: type anything in the text bar and click the ```GENERATE``` button. 
- Microphone input: click ```START LISTENING```, speak, then click ```STOP LISTENING```. The system will provide a transcript of your speech and analyse it.

Step 3: Review the results. After analysis, each theme shows:
- Artwork 
- Status
- Emotion scores
- Transcript

Step 4: Save your artwork. Once a piece has been generated, the ```SAVE``` button becomes available. This saves the artwork to your gallery area.

## Using The Gallery
The gallery page hosts all of your saved art pieces. Here, you can:

- Delete art pieces by clicking the red ```X``` button found above each gallery item.
- Favourite/unfavourite art pieces by clicking the ```★``` button found above each gallery item.
- Download an image of your art piece to your computer by clicking the ```DOWNLOAD``` button.
- View your art piece in fullscreen by clicking the ```FULLSCREEN``` button.
- Rename your art piece by clicking the ```RENAME``` button.

## Viewing Your Favourite Art Pieces
The favourites pages hosts all favourited art pieces. Here, the functionality is similar to the gallery:

- Delete art pieces by clicking the red ```X``` button found above each gallery item.
- Unfavourite the art pieces by clicking the ```★``` button found above each gallery item.
- Download an image of your art piece to your computer by clicking the ```DOWNLOAD``` button.
- View your art piece in fullscreen by clicking the ```FULLSCREEN``` button.
- Rename your art piece by clicking the ```RENAME``` button.

## Settings
The settings page provides a range of options, allowing you to configure:

- The appearance of the application.
- The accessibility options.
- The audio and input options.
- The emotion classifier model.
- The saving options.
- The privacy options.

To save any changes you make, you must scroll to the bottom of the page and select ```SAVE CHANGES```. 


# EmotionArt Developer Guide

## Tech Stack
The important technologies used are:
- Python 3.12
- Flask
- FlaskCORS
- p5.js
- Jinja2
- Hugging Face Transformers (NLP)
- PyTorch (NLP)
- J-Hartmann's Distilroberta-base (Emotion Classification)
- J-Hartmann's Distilroberta-large (Emotion Classification)

## How To Add A New Theme Page
Step 1: Create a route in ```app.py```. You can copy an existing route and change the route names.

Step 2: Create the HTML page in ```pages/```. It's best to copy an existing theme and modify it. Some good examples to copy are ```spirals.html``` or ```flow_field.html```.

Step 3: Create a JavaScript controller in ```assets/javascript/```. You should:
- Define how the artwork is rendered.
- Implement ```applyEmotions()```, ```getEmotionArtSettings()```, ```saveArtwork()```, ```captureImage()```.
- Add a call to ```POST /analyse``` to retrieve the emotion scores.
- Ensure the file matches the HTML IDs used by the page, especially ```mic-toggle```, ```text-input```, ```text-submit```, ```status```, ```output```, ```transcript```, ```save output```.
Once again, it's a good idea to copy an existing theme's logic and modify it. A good example to copy would be: ```assets/javascript/anamorphic-resonance/anamorphic-resonance-app.js```. 

Step 4: Return to your HTML page in```pages/``` and add add your script(s) with ```<script src=""></script>```. If you copied and modified a HTML page then remove the existing scripts.

Step 5: Add the theme to the main themes page. Do this by updating ```pages/index.html``` with:
- A theme tile link.
- A preview image.
- A theme name.
- A credit label.
- A short description of your theme.

## Settings 
- The settings are stored in ```emotionart-settings```. The logic lives in ```assets/javascript/settings.js```.
- Settings are applied by writing ```data-*``` attributes onto <html>, ```base.css``` reacts to those attributes. Non-visual settings are still stored in the same settings object, but are handled in ```settings.js```.
- Themes can read current settings with ```getEmotionArtSettings()```.

## Gallery & Favourites
Gallery saving and favouriting is local.

The frontend sends:
- page_name
- image_data as PNG
- transcript
- emotions
- filename_pattern

The backend writes:
- Image file in ```gallery/```.
- Metadata JSON in ```gallery/```.

Related endpoints:
- ```POST /api/gallery/save```
- ```POST /api/gallery/rename```
- ```POST /api/gallery/favourite```
- ```POST /api/gallery/delete```

## Style Convention
All main styling is found in ```assets/stlyes/base.css```.

The UI is built around:
- .app-shell
- .app-sidebar
- .app-main
- .page-header
- .page-content
- .visual-stage
- .overlay-panel
- .control-dock

Please reuse existing classes. The app already supports:
- dark mode
- high contrast
- reduced motion
- reduced retro styling
- larger text
- compact density

So please do not hardcode any styling as it will not update correctly with the app.
