# VibeNotify

A VS Code extension that intelligently notifies you when AI chat conversations finish and helps you execute extracted commands seamlessly.

## Features

### 🔔 Smart AI Chat Notifications
- Automatically detects when AI chat conversations become idle
- Configurable silence period to avoid false positives
- Optional sound notifications
- Focus IDE window and reveal chat document

### 🚀 Command Extraction & Execution
- Automatically extracts shell commands from code blocks
- Supports multiple shell languages (bash, powershell, cmd, zsh, fish)
- One-click command execution in terminal or VS Code tasks
- Smart command detection with language inference

### 🎯 Interactive Notifications
- Click to focus chat document
- Run extracted commands directly from notifications
- Retry failed commands
- Test notifications for debugging

### ⚙️ Flexible Configuration
- Customizable chat file patterns
- Configurable silence detection timing
- Choose between terminal or VS Code tasks execution
- Optional status bar indicator
- Sound notification controls

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "VibeNotify"
4. Click Install

### Manual Installation
1. Download the `.vsix` file from releases
2. Open VS Code
3. Run `Extensions: Install from VSIX...` command
4. Select the downloaded file

### Development Installation
1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 to launch Extension Development Host

## Quick Start

1. **Enable the extension**: Use `Ctrl+Shift+P` → `VibeNotify: Toggle`
2. **Configure chat patterns**: Set file patterns that match your AI chat files
3. **Test notifications**: Use `Ctrl+Shift+P` → `VibeNotify: Test Notification`
4. **Start chatting**: Open an AI chat file and wait for idle detection

## Configuration

Access settings via `File > Preferences > Settings` and search for "vibenotify":

### Core Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vibenotify.enabled` | `true` | Enable/disable the extension |
| `vibenotify.silenceMs` | `3000` | Milliseconds of silence before triggering notification |
| `vibenotify.chatMatchers` | `["*chat*", "*ai*", "*gpt*", "*claude*"]` | File patterns to match chat documents |
| `vibenotify.notifyWithSound` | `true` | Play sound with notifications |
| `vibenotify.showStatusBar` | `true` | Show status bar indicator |

### Advanced Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vibenotify.terminalName` | `"VibeNotify"` | Name for created terminals |
| `vibenotify.useTasks` | `false` | Use VS Code tasks instead of terminal |
| `vibenotify.autoRevealOnFinish` | `true` | Auto-focus editor when chat finishes |
| `vibenotify.soundFile` | `"media/notification.mp3"` | Path to notification sound file |

### Example Configuration

```json
{
  "vibenotify.enabled": true,
  "vibenotify.silenceMs": 5000,
  "vibenotify.chatMatchers": [
    "**/chat/**",
    "**/*conversation*",
    "**/*ai-chat*",
    "**/gpt/**"
  ],
  "vibenotify.notifyWithSound": true,
  "vibenotify.useTasks": false,
  "vibenotify.terminalName": "AI Commands"
}
```

## Commands

All commands are available via `Ctrl+Shift+P`:

| Command | Description |
|---------|-------------|
| `VibeNotify: Toggle` | Enable/disable the extension |
| `VibeNotify: Test Notification` | Show a test notification |
| `VibeNotify: Run Last Extracted Commands` | Execute the most recently extracted commands |
| `VibeNotify: Show Source` | Focus the active document |

## How It Works

### Chat Idle Detection
1. Monitors text changes in documents matching chat patterns
2. Starts a timer when changes stop
3. Triggers notification after configured silence period
4. Extracts commands from document content
5. Shows interactive notification with actions

### Command Extraction
- Scans document for fenced code blocks (```)
- Identifies shell languages: `bash`, `sh`, `powershell`, `cmd`, `zsh`, `fish`
- Extracts executable commands
- Filters out comments and non-executable lines
- Provides language hints for execution

### Command Execution
- **Terminal Mode**: Creates/reuses named terminal and sends commands
- **Tasks Mode**: Creates VS Code tasks for each command
- Handles multi-line commands and command sequences
- Provides execution feedback via notifications

## File Pattern Matching

The extension uses glob patterns to identify chat files:

```javascript
// Examples of supported patterns:
"*chat*"           // Any file with 'chat' in the name
"**/*ai*"          // Any file with 'ai' in the name, any directory
"**/conversations/**" // Any file in a 'conversations' directory
"*.md"             // All Markdown files
"chat-*.txt"       // Files starting with 'chat-' and ending with '.txt'
```

## Troubleshooting

### Extension Not Working
1. Check if extension is enabled: Look for status bar indicator
2. Verify file patterns: Ensure your chat files match the configured patterns
3. Check silence period: Make sure you're waiting long enough for detection
4. Review VS Code output: Check "VibeNotify" output channel for errors

### Commands Not Executing
1. Verify terminal permissions
2. Check if commands are properly extracted (use test notification)
3. Ensure VS Code has terminal access
4. Try switching between terminal and tasks mode

### Sound Not Playing
1. Check `vibenotify.notifyWithSound` setting
2. Verify sound file exists at configured path
3. Ensure VS Code has audio permissions
4. Try with default sound file

### Common Issues

**Q: Notifications appear too frequently**
A: Increase `vibenotify.silenceMs` value

**Q: No notifications for my chat files**
A: Add appropriate patterns to `vibenotify.chatMatchers`

**Q: Commands not extracted properly**
A: Ensure code blocks use proper fencing (```) with language identifiers

**Q: Terminal commands fail**
A: Check command syntax and try `vibenotify.useTasks: true`

## Development

### Building from Source

```bash
# Clone repository
git clone <repository-url>
cd notify-vibe

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes (development)
npm run watch

# Package extension
npm run package
```

### Project Structure

```
src/
├── extension.ts              # Main extension entry point
├── config.ts                 # Configuration management
├── notifier.ts              # Notification system
├── detection/
│   └── chatIdleDetector.ts   # Chat idle detection logic
├── parse/
│   └── extractCommands.ts    # Command extraction from text
└── terminal/
    ├── terminalRunner.ts     # Terminal command execution
    └── taskRunner.ts         # VS Code tasks execution
```

### Testing

```bash
# Run tests
npm test

# Run in development mode
npm run watch
# Then press F5 in VS Code
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Use VS Code stable APIs only
- Maintain cross-platform compatibility
- Add appropriate error handling
- Update documentation for new features

## License

MIT License - see LICENSE file for details

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Support

If you encounter issues or have feature requests:
1. Check existing issues on GitHub
2. Create a new issue with detailed description
3. Include VS Code version and extension version
4. Provide sample files and configuration if relevant

---

**Enjoy seamless AI chat notifications with VibeNotify!** 🎉