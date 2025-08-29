import * as vscode from 'vscode';
import { Config } from '../config';
import { ShellLanguage } from '../parse/extractCommands';

export interface TaskExecutionResult {
    success: boolean;
    task: vscode.Task;
    execution?: vscode.TaskExecution;
    commands: string[];
    error?: string;
}

export interface TaskCompletionEvent {
    task: vscode.Task;
    exitCode: number | undefined;
    success: boolean;
    commands: string[];
}

export class TaskRunner {
    private disposables: vscode.Disposable[] = [];
    private onTaskCompletionEmitter = new vscode.EventEmitter<TaskCompletionEvent>();
    private runningTasks = new Map<string, { commands: string[]; startTime: number }>();
    private taskCounter = 0;

    public readonly onTaskCompletion = this.onTaskCompletionEmitter.event;

    constructor(
        private config: Config,
        private context: vscode.ExtensionContext
    ) {
        this.setupListeners();
    }

    private setupListeners(): void {
        // Listen for task start events
        this.disposables.push(
            vscode.tasks.onDidStartTask(this.onTaskStart.bind(this))
        );

        // Listen for task end events
        this.disposables.push(
            vscode.tasks.onDidEndTask(this.onTaskEnd.bind(this))
        );
        
        // Listen for task process end events to get exit codes
        this.disposables.push(
            vscode.tasks.onDidEndTaskProcess(this.onTaskProcessEnd.bind(this))
        );
    }

    /**
     * Run commands using VS Code Tasks API
     */
    public async run(commands: string[], languageHint?: ShellLanguage | null): Promise<TaskExecutionResult> {
        if (commands.length === 0) {
            return {
                success: false,
                task: this.createDummyTask(),
                commands: [],
                error: 'No commands to execute'
            };
        }

        try {
            const task = this.createTask(commands, languageHint);
            const execution = await vscode.tasks.executeTask(task);

            // Store task info for completion tracking
            this.runningTasks.set(task.name, {
                commands: [...commands],
                startTime: Date.now()
            });

            return {
                success: true,
                task,
                execution,
                commands
            };
        } catch (error) {
            return {
                success: false,
                task: this.createDummyTask(),
                commands,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Create a VS Code Task for the given commands
     */
    private createTask(commands: string[], languageHint?: ShellLanguage | null): vscode.Task {
        const taskName = `VibeNotify-${++this.taskCounter}`;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        // Determine shell and command based on platform and language hint
        const { shell, commandLine } = this.buildShellExecution(commands, languageHint);
        
        const shellOptions: vscode.ShellExecutionOptions = {};
        
        if (workspaceFolder) {
            shellOptions.cwd = workspaceFolder.uri.fsPath;
        }
        
        if (shell) {
            shellOptions.executable = shell;
        }
        
        const shellExecution = new vscode.ShellExecution(commandLine, shellOptions);

        const task = new vscode.Task(
            { type: 'vibenotify', id: taskName },
            workspaceFolder || vscode.TaskScope.Workspace,
            taskName,
            'VibeNotify',
            shellExecution,
            []
        );

        // Configure task properties
        task.group = vscode.TaskGroup.Build;
        task.presentationOptions = {
            echo: true,
            reveal: vscode.TaskRevealKind.Always,
            focus: false,
            panel: vscode.TaskPanelKind.Shared,
            showReuseMessage: true,
            clear: false
        };

        return task;
    }

    /**
     * Build shell execution based on platform and language hint
     */
    private buildShellExecution(commands: string[], languageHint?: ShellLanguage | null): {
        shell: string | undefined;
        commandLine: string;
    } {
        const isWindows = process.platform === 'win32';
        const joinedCommands = commands.join(' && ');

        // Determine shell based on language hint and platform
        let shell: string | undefined;
        let commandLine: string;

        if (languageHint) {
            switch (languageHint) {
                case 'powershell':
                case 'pwsh':
                    shell = isWindows ? 'powershell.exe' : 'pwsh';
                    commandLine = joinedCommands;
                    break;
                    
                case 'cmd':
                    if (isWindows) {
                        shell = 'cmd.exe';
                        commandLine = `/c ${joinedCommands}`;
                    } else {
                        // Fallback to default shell on non-Windows
                        shell = undefined;
                        commandLine = joinedCommands;
                    }
                    break;
                    
                case 'bash':
                    shell = 'bash';
                    commandLine = `-c "${this.escapeForBash(joinedCommands)}"`;
                    break;
                    
                case 'zsh':
                    shell = 'zsh';
                    commandLine = `-c "${this.escapeForBash(joinedCommands)}"`;
                    break;
                    
                case 'sh':
                    shell = 'sh';
                    commandLine = `-c "${this.escapeForBash(joinedCommands)}"`;
                    break;
                    
                default:
                    shell = undefined;
                    commandLine = joinedCommands;
            }
        } else {
            // No language hint, use default shell
            shell = undefined;
            commandLine = joinedCommands;
        }

        return { shell, commandLine };
    }

    /**
     * Escape commands for bash execution
     */
    private escapeForBash(command: string): string {
        return command.replace(/"/g, '\\"');
    }

    /**
     * Handle task start event
     */
    private onTaskStart(e: vscode.TaskStartEvent): void {
        // Optional: Log task start for debugging
        if (e.execution.task.source === 'VibeNotify') {
            console.log(`VibeNotify: Task started - ${e.execution.task.name}`);
        }
    }

    /**
     * Handle task end event
     */
    private onTaskEnd(e: vscode.TaskEndEvent): void {
        // Task ended, but we'll wait for process end event for exit code
    }
    
    /**
     * Handle task process end event
     */
    private onTaskProcessEnd(e: vscode.TaskProcessEndEvent): void {
        const task = e.execution.task;
        
        // Only handle our tasks
        if (task.source !== 'VibeNotify') {
            return;
        }

        const taskInfo = this.runningTasks.get(task.name);
        if (!taskInfo) {
            return;
        }

        // Clean up tracking
        this.runningTasks.delete(task.name);

        // Determine success based on exit code
        const exitCode = e.exitCode;
        const success = exitCode === 0;

        // Fire completion event
        const completionEvent: TaskCompletionEvent = {
            task,
            exitCode,
            success,
            commands: taskInfo.commands
        };

        this.onTaskCompletionEmitter.fire(completionEvent);
    }

    /**
     * Create a dummy task for error cases
     */
    private createDummyTask(): vscode.Task {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return new vscode.Task(
            { type: 'vibenotify', id: 'dummy' },
            workspaceFolder || vscode.TaskScope.Workspace,
            'Dummy Task',
            'VibeNotify',
            new vscode.ShellExecution('echo "No task"'),
            []
        );
    }

    /**
     * Get information about running tasks
     */
    public getRunningTasksInfo(): Array<{
        name: string;
        commands: string[];
        duration: number;
    }> {
        const now = Date.now();
        return Array.from(this.runningTasks.entries()).map(([name, info]) => ({
            name,
            commands: [...info.commands],
            duration: now - info.startTime
        }));
    }

    /**
     * Check if tasks are currently running
     */
    public hasRunningTasks(): boolean {
        return this.runningTasks.size > 0;
    }

    /**
     * Stop all running VibeNotify tasks
     */
    public async stopAllTasks(): Promise<void> {
        const runningTasks = vscode.tasks.taskExecutions.filter(
            execution => execution.task.source === 'VibeNotify'
        );

        for (const execution of runningTasks) {
            try {
                execution.terminate();
            } catch (error) {
                console.warn(`Failed to terminate task ${execution.task.name}:`, error);
            }
        }

        // Clear our tracking
        this.runningTasks.clear();
    }

    /**
     * Get the last task execution result (for testing/debugging)
     */
    public getLastTaskResult(): TaskCompletionEvent | null {
        // This would require storing the last result, which we can add if needed
        return null;
    }

    /**
     * Create a task definition for tasks.json (for user customization)
     */
    public createTaskDefinition(commands: string[], name?: string): any {
        const taskName = name || `VibeNotify Commands`;
        const joinedCommands = commands.join(' && ');

        return {
            type: 'shell',
            label: taskName,
            command: joinedCommands,
            group: 'build',
            presentation: {
                echo: true,
                reveal: 'always',
                focus: false,
                panel: 'shared',
                showReuseMessage: true,
                clear: false
            },
            problemMatcher: []
        };
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.onTaskCompletionEmitter.dispose();
        this.runningTasks.clear();
    }
}