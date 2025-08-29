import * as vscode from 'vscode';
import { Config } from '../config';

export interface IdleEvent {
    document: vscode.TextDocument;
    reason: 'idle';
    previousContent: string;
    currentContent: string;
    changesSinceLastIdle: number;
}

interface DocumentState {
    timeout: NodeJS.Timeout | null;
    lastLength: number;
    lastVersion: number;
    lastContent: string;
    changeCount: number;
    source: vscode.TextDocument;
}

export class ChatIdleDetector {
    private documentStates = new Map<string, DocumentState>();
    private disposables: vscode.Disposable[] = [];
    private onIdleEmitter = new vscode.EventEmitter<IdleEvent>();
    private isEnabled = true;

    public readonly onIdle = this.onIdleEmitter.event;

    constructor(private config: Config) {
        this.setupListeners();
    }

    private setupListeners(): void {
        // Listen for text document changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.onTextDocumentChange.bind(this))
        );

        // Listen for document close events to clean up state
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(this.onTextDocumentClose.bind(this))
        );

        // Listen for configuration changes
        this.disposables.push(
            this.config.onDidChangeConfiguration(this.onConfigurationChange.bind(this))
        );

        // Update enabled state from config
        this.isEnabled = this.config.enabled;
    }

    private onTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (!this.isEnabled) {
            return;
        }

        const document = event.document;
        
        // Check if this document matches our chat patterns
        if (!this.config.matchesChat(document)) {
            return;
        }

        // Skip if no actual content changes
        if (event.contentChanges.length === 0) {
            return;
        }

        const documentKey = this.getDocumentKey(document);
        const currentState = this.documentStates.get(documentKey);
        const currentContent = document.getText();
        const currentLength = currentContent.length;
        const currentVersion = document.version;

        // Initialize or update document state
        if (!currentState) {
            this.documentStates.set(documentKey, {
                timeout: null,
                lastLength: currentLength,
                lastVersion: currentVersion,
                lastContent: currentContent,
                changeCount: 1,
                source: document
            });
        } else {
            // Clear existing timeout
            if (currentState.timeout) {
                clearTimeout(currentState.timeout);
            }

            // Update state
            currentState.lastLength = currentLength;
            currentState.lastVersion = currentVersion;
            currentState.changeCount++;
            currentState.source = document;
        }

        // Set new timeout for idle detection
        const state = this.documentStates.get(documentKey)!;
        const silenceMs = this.config.silenceMs;
        
        state.timeout = setTimeout(() => {
            this.onDocumentIdle(documentKey, currentContent);
        }, silenceMs);
    }

    private onTextDocumentClose(document: vscode.TextDocument): void {
        const documentKey = this.getDocumentKey(document);
        const state = this.documentStates.get(documentKey);
        
        if (state) {
            if (state.timeout) {
                clearTimeout(state.timeout);
            }
            this.documentStates.delete(documentKey);
        }
    }

    private onConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
        const wasEnabled = this.isEnabled;
        this.isEnabled = this.config.enabled;

        // If disabled, clear all timeouts and states
        if (!this.isEnabled && wasEnabled) {
            this.clearAllStates();
        }

        // If silence duration changed, we don't need to do anything special
        // as new timeouts will use the updated value
    }

    private onDocumentIdle(documentKey: string, currentContent: string): void {
        const state = this.documentStates.get(documentKey);
        if (!state) {
            return;
        }

        // Clear the timeout since we're handling the idle event
        state.timeout = null;

        // Prepare idle event
        const idleEvent: IdleEvent = {
            document: state.source,
            reason: 'idle',
            previousContent: state.lastContent,
            currentContent: currentContent,
            changesSinceLastIdle: state.changeCount
        };

        // Update state for next idle detection
        state.lastContent = currentContent;
        state.changeCount = 0;

        // Fire the idle event
        this.onIdleEmitter.fire(idleEvent);
    }

    private getDocumentKey(document: vscode.TextDocument): string {
        // Use URI as the unique key for the document
        return document.uri.toString();
    }

    private clearAllStates(): void {
        for (const [key, state] of this.documentStates) {
            if (state.timeout) {
                clearTimeout(state.timeout);
            }
        }
        this.documentStates.clear();
    }

    /**
     * Enable or disable the idle detector
     */
    public setEnabled(enabled: boolean): void {
        if (this.isEnabled === enabled) {
            return;
        }

        this.isEnabled = enabled;
        
        if (!enabled) {
            this.clearAllStates();
        }
    }

    /**
     * Get current state information for debugging
     */
    public getDebugInfo(): {
        enabled: boolean;
        trackedDocuments: number;
        activeTimeouts: number;
    } {
        let activeTimeouts = 0;
        for (const state of this.documentStates.values()) {
            if (state.timeout) {
                activeTimeouts++;
            }
        }

        return {
            enabled: this.isEnabled,
            trackedDocuments: this.documentStates.size,
            activeTimeouts
        };
    }

    /**
     * Manually trigger idle detection for a specific document (for testing)
     */
    public triggerIdleForDocument(document: vscode.TextDocument): void {
        if (!this.isEnabled) {
            return;
        }

        const documentKey = this.getDocumentKey(document);
        const state = this.documentStates.get(documentKey);
        
        if (state) {
            if (state.timeout) {
                clearTimeout(state.timeout);
            }
            this.onDocumentIdle(documentKey, document.getText());
        }
    }

    /**
     * Check if a document is currently being tracked
     */
    public isTrackingDocument(document: vscode.TextDocument): boolean {
        const documentKey = this.getDocumentKey(document);
        return this.documentStates.has(documentKey);
    }

    /**
     * Get the current change count for a document
     */
    public getChangeCount(document: vscode.TextDocument): number {
        const documentKey = this.getDocumentKey(document);
        const state = this.documentStates.get(documentKey);
        return state ? state.changeCount : 0;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.clearAllStates();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.onIdleEmitter.dispose();
    }
}