import * as vscode from 'vscode';
import * as path from 'path';
import { Config } from './config';
import { ExtractedCommands } from './parse/extractCommands';

export interface NotificationAction {
    title: string;
    action: () => Promise<void> | void;
}

export interface NotificationOptions {
    message: string;
    actions?: NotificationAction[];
    playSound?: boolean;
    focusEditor?: boolean;
    sourceDocument?: vscode.TextDocument;
}

export class Notifier {
    private soundWebview: vscode.WebviewPanel | null = null;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private config: Config,
        private context: vscode.ExtensionContext
    ) {}

    /**
     * Show a notification with optional actions
     */
    public async showNotification(options: NotificationOptions): Promise<void> {
        const { message, actions = [], playSound, focusEditor, sourceDocument } = options;

        // Focus the IDE window first
        if (focusEditor && sourceDocument) {
            await this.focusDocument(sourceDocument);
        }

        // Play sound if enabled and requested
        if (playSound && this.config.notifyWithSound) {
            await this.playNotificationSound();
        }

        // Prepare action titles for VS Code notification
        const actionTitles = actions.map(action => action.title);

        try {
            // Show the notification
            const selectedAction = await vscode.window.showInformationMessage(
                message,
                ...actionTitles
            );

            // Execute the selected action
            if (selectedAction) {
                const action = actions.find(a => a.title === selectedAction);
                if (action) {
                    await action.action();
                }
            }
        } catch (error) {
            console.error('VibeNotify: Error showing notification:', error);
        }
    }

    /**
     * Show notification for AI chat completion
     */
    public async showChatIdleNotification(
        document: vscode.TextDocument,
        extractedCommands?: ExtractedCommands
    ): Promise<void> {
        const hasCommands = extractedCommands && extractedCommands.commands.length > 0;
        
        const message = hasCommands 
            ? `AI reply finished with ${extractedCommands.commands.length} command(s) found`
            : 'AI reply finished';

        const actions: NotificationAction[] = [
            {
                title: 'Show Chat',
                action: () => this.focusDocument(document)
            }
        ];

        if (hasCommands) {
            actions.push({
                title: 'Run in Terminal',
                action: () => this.executeCommands(extractedCommands)
            });
        }

        await this.showNotification({
            message,
            actions,
            playSound: true,
            focusEditor: this.config.autoRevealOnFinish,
            sourceDocument: document
        });
    }

    /**
     * Show notification for task completion
     */
    public async showTaskCompletionNotification(
        success: boolean,
        exitCode: number | undefined,
        commands: string[]
    ): Promise<void> {
        const message = success 
            ? `Commands executed successfully (exit code: ${exitCode ?? 0})`
            : `Commands failed (exit code: ${exitCode ?? 'unknown'})`;

        const actions: NotificationAction[] = [];

        if (!success) {
            actions.push({
                title: 'Retry',
                action: () => this.executeCommands({ commands, languageHint: null, rawBlocks: [] })
            });
        }

        await this.showNotification({
            message,
            actions,
            playSound: !success // Only play sound on failure
        });
    }

    /**
     * Show a test notification
     */
    public async showTestNotification(document?: vscode.TextDocument): Promise<void> {
        const message = document 
            ? `Test notification from ${path.basename(document.fileName)}`
            : 'VibeNotify test notification';

        const actions: NotificationAction[] = [
            {
                title: 'Show Source',
                action: () => document ? this.focusDocument(document) : Promise.resolve()
            },
            {
                title: 'Test Sound',
                action: () => this.playNotificationSound()
            }
        ];

        const notificationOptions: NotificationOptions = {
            message,
            actions,
            playSound: true
        };
        
        if (document) {
            notificationOptions.sourceDocument = document;
        }
        
        await this.showNotification(notificationOptions);
    }

    /**
     * Focus a specific document
     */
    public async focusDocument(document: vscode.TextDocument): Promise<void> {
        try {
            await vscode.window.showTextDocument(document, {
                preview: false,
                preserveFocus: false
            });
        } catch (error) {
            console.error('VibeNotify: Error focusing document:', error);
            vscode.window.showErrorMessage(`Could not focus document: ${document.fileName}`);
        }
    }

    /**
     * Execute extracted commands (this will be called by the main extension)
     */
    private async executeCommands(extractedCommands: ExtractedCommands): Promise<void> {
        // This is a placeholder - the actual execution will be handled by the main extension
        // We emit a custom event or call back to the extension's command execution logic
        
        // For now, we'll use the command palette to trigger our command
        try {
            await vscode.commands.executeCommand('vibenotify.runLastExtractedInTerminal');
        } catch (error) {
            console.error('VibeNotify: Error executing commands:', error);
            vscode.window.showErrorMessage('Failed to execute commands');
        }
    }

    /**
     * Play notification sound
     */
    private async playNotificationSound(): Promise<void> {
        if (!this.config.notifyWithSound) {
            return;
        }

        try {
            // Create a simple webview to play sound
            await this.createSoundWebview();
        } catch (error) {
            console.warn('VibeNotify: Could not play notification sound:', error);
        }
    }

    /**
     * Create a hidden webview to play sound
     */
    private async createSoundWebview(): Promise<void> {
        // Dispose existing webview if any
        if (this.soundWebview) {
            this.soundWebview.dispose();
        }

        try {
            this.soundWebview = vscode.window.createWebviewPanel(
                'vibenotifySound',
                'VibeNotify Sound',
                { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
                {
                    enableScripts: true,
                    retainContextWhenHidden: false
                }
            );

            // Hide the webview immediately
            this.soundWebview.reveal(vscode.ViewColumn.Active, true);

            // Get sound file path
            const soundFile = this.config.soundFile;
            const soundPath = path.isAbsolute(soundFile) 
                ? soundFile 
                : path.join(this.context.extensionPath, soundFile);

            // Create HTML content with audio element
            const soundUri = this.soundWebview.webview.asWebviewUri(
                vscode.Uri.file(soundPath)
            );

            this.soundWebview.webview.html = this.getSoundWebviewContent(soundUri.toString());

            // Dispose webview after a short delay
            setTimeout(() => {
                if (this.soundWebview) {
                    this.soundWebview.dispose();
                    this.soundWebview = null;
                }
            }, 3000);

        } catch (error) {
            console.warn('VibeNotify: Failed to create sound webview:', error);
            
            // Fallback: try to use system notification sound
            this.playSystemNotificationSound();
        }
    }

    /**
     * Get HTML content for sound webview
     */
    private getSoundWebviewContent(soundUri: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>VibeNotify Sound</title>
                <style>
                    body { margin: 0; padding: 0; background: transparent; }
                    audio { display: none; }
                </style>
            </head>
            <body>
                <audio id="notificationSound" autoplay>
                    <source src="${soundUri}" type="audio/mpeg">
                    <source src="${soundUri}" type="audio/wav">
                    <source src="${soundUri}" type="audio/ogg">
                </audio>
                <script>
                    const audio = document.getElementById('notificationSound');
                    audio.volume = 0.5;
                    audio.play().catch(e => console.log('Could not play sound:', e));
                </script>
            </body>
            </html>
        `;
    }

    /**
     * Fallback system notification sound
     */
    private playSystemNotificationSound(): void {
        // This is a simple fallback that works on most systems
        // We create a simple beep using the system bell
        try {
            // On Windows, we can try to use the system beep
            if (process.platform === 'win32') {
                // Use console.log with bell character as a simple fallback
                console.log('\u0007'); // Bell character
            }
        } catch (error) {
            // Silent fail for sound
        }
    }

    /**
     * Show error notification
     */
    public async showErrorNotification(message: string, error?: Error): Promise<void> {
        const fullMessage = error ? `${message}: ${error.message}` : message;
        
        try {
            await vscode.window.showErrorMessage(fullMessage);
        } catch (e) {
            console.error('VibeNotify: Error showing error notification:', e);
        }
    }

    /**
     * Show warning notification
     */
    public async showWarningNotification(message: string): Promise<void> {
        try {
            await vscode.window.showWarningMessage(message);
        } catch (error) {
            console.error('VibeNotify: Error showing warning notification:', error);
        }
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        if (this.soundWebview) {
            this.soundWebview.dispose();
            this.soundWebview = null;
        }
        
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}