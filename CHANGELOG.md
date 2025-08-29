# Changelog

All notable changes to the "VibeNotify" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-20

### Added
- Initial release of VibeNotify extension
- Smart AI chat idle detection with configurable silence periods
- Automatic command extraction from fenced code blocks
- Support for multiple shell languages (bash, powershell, cmd, zsh, fish)
- Interactive notifications with action buttons
- Command execution via terminal or VS Code tasks
- Sound notifications with customizable audio files
- Status bar indicator with toggle functionality
- Comprehensive configuration options
- Cross-platform compatibility (Windows, macOS, Linux)

### Features
- **Chat Idle Detection**: Monitors text document changes and detects when AI conversations become idle
- **Command Extraction**: Intelligently extracts shell commands from code blocks with language inference
- **Notification System**: Shows interactive notifications with options to focus chat or run commands
- **Terminal Integration**: Execute commands in named terminals or VS Code tasks
- **Configuration Management**: Extensive settings for customizing behavior
- **Status Bar Integration**: Visual indicator of extension state
- **Sound Support**: Optional audio notifications with webview-based playback

### Commands
- `vibenotify.toggle` - Enable/disable the extension
- `vibenotify.testNotification` - Show a test notification for debugging
- `vibenotify.runLastExtractedInTerminal` - Execute the most recently extracted commands
- `vibenotify.showSource` - Focus the active document

### Configuration Options
- `vibenotify.enabled` - Enable/disable extension (default: true)
- `vibenotify.silenceMs` - Silence period in milliseconds (default: 3000)
- `vibenotify.chatMatchers` - File patterns for chat documents (default: ["*chat*", "*ai*", "*gpt*", "*claude*"])
- `vibenotify.notifyWithSound` - Enable sound notifications (default: true)
- `vibenotify.soundFile` - Path to notification sound file (default: "media/notification.mp3")
- `vibenotify.showStatusBar` - Show status bar indicator (default: true)
- `vibenotify.terminalName` - Name for created terminals (default: "VibeNotify")
- `vibenotify.useTasks` - Use VS Code tasks instead of terminal (default: false)
- `vibenotify.autoRevealOnFinish` - Auto-focus editor when chat finishes (default: true)

### Technical Implementation
- **TypeScript**: Full TypeScript implementation with strict type checking
- **Modular Architecture**: Clean separation of concerns with dedicated modules
- **Event-Driven**: Reactive architecture using VS Code's event system
- **Error Handling**: Comprehensive error handling and logging
- **Resource Management**: Proper disposal of resources and event listeners
- **Cross-Platform**: Uses only stable VS Code APIs for maximum compatibility

### File Structure
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

### Dependencies
- **Runtime**: No external runtime dependencies
- **Development**: TypeScript, @types/vscode, @types/node
- **VS Code API**: Uses stable APIs (1.74.0+)

### Known Limitations
- Sound playback requires webview creation (may have slight delay)
- Command extraction limited to fenced code blocks with language identifiers
- Terminal execution depends on system shell availability
- File pattern matching uses simple glob patterns

---

## [Unreleased]

### Planned Features
- Enhanced command extraction with natural language processing
- Support for more programming languages and shell types
- Customizable notification templates
- Integration with popular AI chat platforms
- Command history and favorites
- Batch command execution with dependency management
- Advanced file pattern matching with regex support
- Notification scheduling and quiet hours
- Extension API for third-party integrations

### Potential Improvements
- Reduce webview overhead for sound playback
- Add command validation before execution
- Implement command output capture and display
- Add support for interactive commands
- Improve error messages and user feedback
- Add telemetry for usage analytics (opt-in)
- Implement command templates and snippets
- Add support for remote development environments

---

## Version History

### Pre-release Development
- **0.9.0** - Beta testing with core functionality
- **0.8.0** - Alpha release with basic chat detection
- **0.7.0** - Command extraction prototype
- **0.6.0** - Notification system implementation
- **0.5.0** - Terminal integration development
- **0.4.0** - Configuration system design
- **0.3.0** - Chat idle detection algorithm
- **0.2.0** - Project structure and TypeScript setup
- **0.1.0** - Initial project conception and planning

---

## Migration Guide

### From Pre-release Versions
If you were using a pre-release version of VibeNotify:

1. **Uninstall** the previous version
2. **Install** the new version from the marketplace
3. **Reconfigure** your settings (settings format may have changed)
4. **Test** the functionality with your existing chat files

### Configuration Changes
- No breaking configuration changes in v1.0.0
- All settings maintain backward compatibility
- New settings use sensible defaults

---

## Support and Feedback

### Reporting Issues
When reporting issues, please include:
- VS Code version
- VibeNotify extension version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant configuration settings
- Console output (if applicable)

### Feature Requests
We welcome feature requests! Please:
- Check existing issues first
- Describe the use case clearly
- Explain the expected behavior
- Consider implementation complexity
- Provide examples if applicable

### Contributing
See [README.md](README.md) for development setup and contribution guidelines.

---

**Thank you for using VibeNotify!** 🎉

For the latest updates and announcements, watch the repository and check the VS Code marketplace page.