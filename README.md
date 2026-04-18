```To any and all developers, there is a developer guide after the user guide! (not added yet)```

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

- Themes: choose an art style
- Gallery: view all saved artwork
- Favourites: view only starred artwork
- Settings: change app behavior and appearance

## How To Use A Theme
Step 1: Go to Themes and click the one you want use.

Step 2: Enter your input. You can use:
- Text input: type anything in the text bar and click the generate button. 
- Microphone input: click Start Listening, speak, then click stop listening. The system will provide a transcript of your speech and analyse it.

Step 3: Review the results. After analysis, each theme shows:
- Artwork 
- Status
- Emotion scores
- Transcript

Step 4: Save your artwork. Once a piece has been generated, the Save button becomes available. This saves the artwork to your gallery area.

## Using The Gallery
The gallery page hosts all of your saved art pieces. Here, you can:

- Delete art pieces by clicking the red 'x' button found above each gallery item.
- Favourite/unfavourite art pieces by clicking the star button found above each gallery item.
- Download an image of your art piece to your computer by clicking the download button.
- View your art piece in fullscreen by clicking the fullscreen button.
- Rename your art piece by clicking the rename button.

## Viewing Your Favourite Art Pieces
The favourites pages hosts all favourited art pieces. Here, the functionality is similar to the gallery:

- Delete art pieces by clicking the red 'x' button found above each gallery item.
- Unfavourite the art pieces by clicking the star button found above each gallery item.
- Download an image of your art piece to your computer by clicking the download button.
- View your art piece in fullscreen by clicking the fullscreen button.
- Rename your art piece by clicking the rename button.

## Settings
The settings page provides a range of options, allowing you to configure:

- The appearance of the application.
- The accessibility options.
- The audio and input options.
- The emotion classifier model.
- The saving options.
- The privacy options.

To save any changes you make, you must scroll to the bottom of the page and select ```SAVE CHANGES```. 
