import * as vscode from 'vscode';
import { Config } from '../config';
import { ShellLanguage } from '../parse/extractCommands';

export interface TerminalExecutionResult {
    success: boolean;
    terminal: vscode.Terminal;
    commands: string[];
    error?: string;
}

export class TerminalRunner {
    private terminals = new Map<string, vscode.Terminal>();
    private lastExtracted: string[] = [];
    private disposables: vscode.Disposable[] = [];

    constructor(
        private config: Config,
        private context: vscode.ExtensionContext
    ) {
        this.setupListeners();
        this.loadLastExtracted();
    }

    private setupListeners(): void {
        // Listen for terminal disposal to clean up our references
        this.disposables.push(
            vscode.window.onDidCloseTerminal(terminal => {
                // Remove from our map if it's one of ours
                for (const [name, term] of this.terminals) {
                    if (term === terminal) {
                        this.terminals.delete(name);
                        break;
                    }
                }
            })
        );
    }

    /**
     * Run commands in the configured terminal
     */
    public async run(commands: string[], languageHint?: ShellLanguage | null): Promise<TerminalExecutionResult> {
        if (commands.length === 0) {
            return {
                success: false,
                terminal: this.getOrCreateTerminal(),
                commands: [],
                error: 'No commands to execute'
            };
        }

        try {
            const terminal = this.getOrCreateTerminal();
            
            // Store commands for later reuse
            this.lastExtracted = [...commands];
            this.saveLastExtracted();

            // Show the terminal
            terminal.show(true);

            // Execute each command
            for (const command of commands) {
                const processedCommand = this.preprocessCommand(command, languageHint);
                terminal.sendText(processedCommand, true);
                
                // Small delay between commands to avoid overwhelming the terminal
                if (commands.length > 1) {
                    await this.delay(100);
                }
            }

            return {
                success: true,
                terminal,
                commands
            };
        } catch (error) {
            return {
                success: false,
                terminal: this.getOrCreateTerminal(),
                commands,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Run the last extracted commands again
     */
    public async runLastExtracted(): Promise<TerminalExecutionResult> {
        if (this.lastExtracted.length === 0) {
            return {
                success: false,
                terminal: this.getOrCreateTerminal(),
                commands: [],
                error: 'No previously extracted commands to run'
            };
        }

        return this.run(this.lastExtracted);
    }

    /**
     * Get the last extracted commands
     */
    public getLastExtracted(): string[] {
        return [...this.lastExtracted];
    }

    /**
     * Clear the last extracted commands
     */
    public clearLastExtracted(): void {
        this.lastExtracted = [];
        this.saveLastExtracted();
    }

    /**
     * Get or create the named terminal
     */
    private getOrCreateTerminal(): vscode.Terminal {
        const terminalName = this.config.terminalName;
        
        // Check if we have a cached terminal that's still alive
        const cachedTerminal = this.terminals.get(terminalName);
        if (cachedTerminal && cachedTerminal.exitStatus === undefined) {
            return cachedTerminal;
        }

        // Look for existing terminal with the same name
        const existingTerminal = vscode.window.terminals.find(t => 
            t.name === terminalName && t.exitStatus === undefined
        );
        
        if (existingTerminal) {
            this.terminals.set(terminalName, existingTerminal);
            return existingTerminal;
        }

        // Create new terminal
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const terminalOptions: vscode.TerminalOptions = {
            name: terminalName
        };
        
        if (workspaceFolder) {
            terminalOptions.cwd = workspaceFolder.uri;
        }
        
        const newTerminal = vscode.window.createTerminal(terminalOptions);

        this.terminals.set(terminalName, newTerminal);
        return newTerminal;
    }

    /**
     * Preprocess command based on shell language and platform
     */
    private preprocessCommand(command: string, languageHint?: ShellLanguage | null): string {
        let processedCommand = command.trim();

        // Handle different shell languages and platforms
        const isWindows = process.platform === 'win32';
        
        if (languageHint) {
            switch (languageHint) {
                case 'powershell':
                case 'pwsh':
                    // PowerShell commands - no special preprocessing needed
                    break;
                    
                case 'cmd':
                    // CMD commands - ensure proper escaping if needed
                    break;
                    
                case 'bash':
                case 'sh':
                case 'zsh':
                    // Unix shell commands
                    if (isWindows) {
                        // On Windows, these might need to run in WSL or Git Bash
                        // For now, just pass through and let the user's default shell handle it
                    }
                    break;
            }
        }

        // Handle multi-line commands
        if (processedCommand.includes('\n')) {
            // Split multi-line commands and return the first line
            // The terminal runner will handle each line separately
            const lines = processedCommand.split('\n').map(line => line.trim()).filter(line => line);
            if (lines.length > 0 && lines[0]) {
                processedCommand = lines[0];
            }
        }

        return processedCommand;
    }

    /**
     * Simple delay utility
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Save last extracted commands to extension state
     */
    private saveLastExtracted(): void {
        this.context.globalState.update('vibenotify.lastExtracted', this.lastExtracted);
    }

    /**
     * Load last extracted commands from extension state
     */
    private loadLastExtracted(): void {
        const saved = this.context.globalState.get<string[]>('vibenotify.lastExtracted');
        if (Array.isArray(saved)) {
            this.lastExtracted = saved;
        }
    }

    /**
     * Get information about available terminals
     */
    public getTerminalInfo(): {
        namedTerminals: Array<{ name: string; active: boolean }>;
        allTerminals: number;
        configuredName: string;
    } {
        const configuredName = this.config.terminalName;
        const namedTerminals: Array<{ name: string; active: boolean }> = [];
        
        for (const [name, terminal] of this.terminals) {
            namedTerminals.push({
                name,
                active: terminal.exitStatus === undefined
            });
        }

        return {
            namedTerminals,
            allTerminals: vscode.window.terminals.length,
            configuredName
        };
    }

    /**
     * Focus the configured terminal if it exists
     */
    public focusTerminal(): boolean {
        const terminal = this.terminals.get(this.config.terminalName);
        if (terminal && terminal.exitStatus === undefined) {
            terminal.show(true);
            return true;
        }
        return false;
    }

    /**
     * Create a new terminal with a specific name
     */
    public createNamedTerminal(name: string): vscode.Terminal {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const terminalOptions: vscode.TerminalOptions = {
            name
        };
        
        if (workspaceFolder) {
            terminalOptions.cwd = workspaceFolder.uri;
        }
        
        const terminal = vscode.window.createTerminal(terminalOptions);
        
        this.terminals.set(name, terminal);
        return terminal;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        // Don't dispose terminals as they should remain available to the user
        this.terminals.clear();
    }
}