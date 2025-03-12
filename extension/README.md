# BeatScript Lyrics

A browser extension that displays lyrics for YouTube music videos in a convenient side drawer.

## Features

- **Automatic Lyrics Detection**: Automatically detects when you're watching a music video on YouTube and fetches the lyrics.
- **Clean UI**: Displays lyrics in a sleek, unobtrusive side drawer that can be resized.
- **Offline Support**: Caches lyrics for videos you've already watched for offline viewing.
- **Dark Mode Support**: Automatically adapts to your browser's dark/light mode preference.
- **Error Handling**: Robust error handling for network issues, YouTube DOM changes, and other edge cases.
- **Feedback System**: Report incorrect lyrics to help improve the service.

## Installation

### Chrome/Edge/Brave

1. Download the extension files or clone this repository
2. Open your browser and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `extension` folder
5. The extension should now be installed and ready to use

### Firefox

1. Download the extension files or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select any file in the `extension` folder
4. The extension should now be installed and ready to use

## Usage

1. Navigate to a YouTube music video
2. The lyrics drawer will automatically open if lyrics are found
3. You can also click the extension icon to toggle the drawer
4. Resize the drawer by dragging the left edge
5. Report incorrect lyrics using the button at the bottom of the drawer

## Development

### Prerequisites

- Node.js and npm
- A modern web browser (Chrome, Firefox, Edge, or Brave)

### Local Development

1. Clone this repository
2. Start the backend server (see backend repository)
3. Load the extension in your browser as described in the Installation section
4. Make changes to the code and reload the extension to see your changes

## Troubleshooting

- **Lyrics Not Showing**: Make sure you're on a YouTube music video page and that the backend server is running.
- **Extension Not Working**: Try refreshing the page or reloading the extension.
- **Error Messages**: Check the console for error messages that might help identify the issue.

## Privacy

This extension only accesses data on YouTube pages and only sends the video title and channel name to the backend server to fetch lyrics. No personal data is collected or stored.

## License

MIT License 