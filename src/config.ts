import * as vscode from 'vscode';

export interface ChatMatcher {
    languageIdRegex: string;
    schemeRegex: string;
    titleRegex: string;
}

export class Config {
    private static readonly SECTION = 'vibenotify';

    private getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(Config.SECTION);
    }

    get enabled(): boolean {
        return this.getConfiguration().get<boolean>('enabled', true);
    }

    get silenceMs(): number {
        return this.getConfiguration().get<number>('silenceMs', 1500);
    }

    get chatMatchers(): ChatMatcher[] {
        return this.getConfiguration().get<ChatMatcher[]>('chatMatchers', [
            {
                languageIdRegex: '^(copilot-chat|chat)$',
                schemeRegex: '.*',
                titleRegex: '.*'
            },
            {
                languageIdRegex: '^markdown$',
                schemeRegex: '.*',
                titleRegex: '(?i)(chat|assistant|reply)'
            }
        ]);
    }

    get notifyWithSound(): boolean {
        return this.getConfiguration().get<boolean>('notifyWithSound', false);
    }

    get soundFile(): string {
        return this.getConfiguration().get<string>('soundFile', 'media/sounds/notify.mp3');
    }

    get showStatusBar(): boolean {
        return this.getConfiguration().get<boolean>('showStatusBar', true);
    }

    get terminalName(): string {
        return this.getConfiguration().get<string>('terminalName', 'VibeNotify');
    }

    get useTasks(): boolean {
        return this.getConfiguration().get<boolean>('useTasks', true);
    }

    get autoRevealOnFinish(): boolean {
        return this.getConfiguration().get<boolean>('autoRevealOnFinish', false);
    }

    async setEnabled(value: boolean): Promise<void> {
        await this.getConfiguration().update('enabled', value, vscode.ConfigurationTarget.Global);
    }

    async setSilenceMs(value: number): Promise<void> {
        await this.getConfiguration().update('silenceMs', value, vscode.ConfigurationTarget.Global);
    }

    async setChatMatchers(value: ChatMatcher[]): Promise<void> {
        await this.getConfiguration().update('chatMatchers', value, vscode.ConfigurationTarget.Global);
    }

    async setNotifyWithSound(value: boolean): Promise<void> {
        await this.getConfiguration().update('notifyWithSound', value, vscode.ConfigurationTarget.Global);
    }

    async setSoundFile(value: string): Promise<void> {
        await this.getConfiguration().update('soundFile', value, vscode.ConfigurationTarget.Global);
    }

    async setShowStatusBar(value: boolean): Promise<void> {
        await this.getConfiguration().update('showStatusBar', value, vscode.ConfigurationTarget.Global);
    }

    async setTerminalName(value: string): Promise<void> {
        await this.getConfiguration().update('terminalName', value, vscode.ConfigurationTarget.Global);
    }

    async setUseTasks(value: boolean): Promise<void> {
        await this.getConfiguration().update('useTasks', value, vscode.ConfigurationTarget.Global);
    }

    async setAutoRevealOnFinish(value: boolean): Promise<void> {
        await this.getConfiguration().update('autoRevealOnFinish', value, vscode.ConfigurationTarget.Global);
    }

    /**
     * Check if a document matches any of the configured chat matchers
     */
    matchesChat(document: vscode.TextDocument): boolean {
        const matchers = this.chatMatchers;
        
        for (const matcher of matchers) {
            try {
                const languageMatch = new RegExp(matcher.languageIdRegex).test(document.languageId);
                const schemeMatch = new RegExp(matcher.schemeRegex).test(document.uri.scheme);
                const titleMatch = new RegExp(matcher.titleRegex).test(document.fileName || '');
                
                if (languageMatch && schemeMatch && titleMatch) {
                    return true;
                }
            } catch (error) {
                console.warn(`VibeNotify: Invalid regex in chat matcher:`, matcher, error);
            }
        }
        
        return false;
    }

    /**
     * Listen for configuration changes
     */
    onDidChangeConfiguration(listener: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(Config.SECTION)) {
                listener(e);
            }
        });
    }
}