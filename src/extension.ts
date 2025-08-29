import * as vscode from 'vscode';
import { Config } from './config';
import { ChatIdleDetector } from './detection/chatIdleDetector';
import { extractCommands, ExtractedCommands } from './parse/extractCommands';
import { TerminalRunner } from './terminal/terminalRunner';
import { TaskRunner } from './terminal/taskRunner';
import { Notifier } from './notifier';

let config: Config;
let chatIdleDetector: ChatIdleDetector;
let terminalRunner: TerminalRunner;
let taskRunner: TaskRunner;
let notifier: Notifier;
let statusBarItem: vscode.StatusBarItem;
let lastExtractedCommands: ExtractedCommands | null = null;

/**
 * Extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('VibeNotify extension is now active');

    // Initialize components
    config = new Config();
    chatIdleDetector = new ChatIdleDetector(config);
    terminalRunner = new TerminalRunner(config, context);
    taskRunner = new TaskRunner(config, context);
    notifier = new Notifier(config, context);

    // Create status bar item
    createStatusBarItem();

    // Register commands
    registerCommands(context);

    // Set up event listeners
    setupEventListeners(context);

    // Start monitoring if enabled
    if (config.enabled) {
        startMonitoring();
    }

    // Update status bar
    updateStatusBar();

    console.log('VibeNotify extension activated successfully');
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    console.log('VibeNotify extension is being deactivated');

    // Stop monitoring
    stopMonitoring();

    // Dispose of components
    if (chatIdleDetector) {
        chatIdleDetector.dispose();
    }
    if (terminalRunner) {
        terminalRunner.dispose();
    }
    if (taskRunner) {
        taskRunner.dispose();
    }
    if (notifier) {
        notifier.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }

    console.log('VibeNotify extension deactivated');
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Toggle extension enabled/disabled
    const toggleCommand = vscode.commands.registerCommand('vibenotify.toggle', async () => {
        const newState = !config.enabled;
        await config.setEnabled(newState);
        
        if (newState) {
            startMonitoring();
            vscode.window.showInformationMessage('VibeNotify enabled');
        } else {
            stopMonitoring();
            vscode.window.showInformationMessage('VibeNotify disabled');
        }
        
        updateStatusBar();
    });

    // Test notification command
    const testNotificationCommand = vscode.commands.registerCommand('vibenotify.testNotification', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        await notifier.showTestNotification(activeEditor?.document);
    });

    // Run last extracted commands in terminal
    const runLastExtractedCommand = vscode.commands.registerCommand('vibenotify.runLastExtractedInTerminal', async () => {
        if (!lastExtractedCommands || lastExtractedCommands.commands.length === 0) {
            vscode.window.showWarningMessage('No commands found to execute');
            return;
        }

        try {
            if (config.useTasks) {
                await taskRunner.run(lastExtractedCommands.commands);
            } else {
                await terminalRunner.run(lastExtractedCommands.commands);
            }
        } catch (error) {
            console.error('VibeNotify: Error running commands:', error);
            await notifier.showErrorNotification('Failed to run commands', error as Error);
        }
    });

    // Show source document command
    const showSourceCommand = vscode.commands.registerCommand('vibenotify.showSource', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            await notifier.focusDocument(activeEditor.document);
        } else {
            vscode.window.showWarningMessage('No active document to show');
        }
    });

    // Register all commands
    context.subscriptions.push(
        toggleCommand,
        testNotificationCommand,
        runLastExtractedCommand,
        showSourceCommand
    );
}

/**
 * Set up event listeners
 */
function setupEventListeners(context: vscode.ExtensionContext) {
    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('vibenotify')) {
            handleConfigurationChange();
        }
    });

    // Listen for chat idle events
    const idleEventListener = chatIdleDetector.onIdle(async (event) => {
        await handleChatIdle(event);
    });

    // Listen for task completion events
    const taskEndListener = taskRunner.onTaskCompletion((event) => {
        handleTaskCompletion(event.success, event.exitCode, event.commands);
    });

    // Register disposables
    context.subscriptions.push(
        configChangeListener,
        idleEventListener,
        taskEndListener
    );
}

/**
 * Handle configuration changes
 */
function handleConfigurationChange() {
    console.log('VibeNotify: Configuration changed');
    
    // Reload configuration
    config = new Config();
    
    // Update components with new config
    chatIdleDetector.setEnabled(config.enabled);
    
    // Update enabled state
    chatIdleDetector.setEnabled(config.enabled);
    
    updateStatusBar();
}

/**
 * Handle chat idle event
 */
async function handleChatIdle(event: any) {
    console.log('VibeNotify: Chat idle detected', {
        document: event.document.fileName,
        changesSinceLastIdle: event.changesSinceLastIdle
    });

    try {
        // Extract commands from the document content
        const extractedCommands = extractCommands(event.currentContent);
        
        // Store the extracted commands for later use
        lastExtractedCommands = extractedCommands;
        
        // Show notification
        await notifier.showChatIdleNotification(event.document, extractedCommands);
        
    } catch (error) {
        console.error('VibeNotify: Error handling chat idle:', error);
        await notifier.showErrorNotification('Error processing chat idle event', error as Error);
    }
}

/**
 * Handle task completion
 */
async function handleTaskCompletion(success: boolean, exitCode: number | undefined, commands: string[]) {
    console.log('VibeNotify: Task completed', { success, exitCode, commands });
    
    try {
        await notifier.showTaskCompletionNotification(success, exitCode, commands);
    } catch (error) {
        console.error('VibeNotify: Error handling task completion:', error);
    }
}

/**
 * Start monitoring for chat idle events
 */
function startMonitoring() {
    console.log('VibeNotify: Starting monitoring');
    chatIdleDetector.setEnabled(true);
}

/**
 * Stop monitoring for chat idle events
 */
function stopMonitoring() {
    console.log('VibeNotify: Stopping monitoring');
    chatIdleDetector.setEnabled(false);
}

/**
 * Create status bar item
 */
function createStatusBarItem() {
    if (!config.showStatusBar) {
        return;
    }

    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    
    statusBarItem.command = 'vibenotify.toggle';
    statusBarItem.tooltip = 'Click to toggle VibeNotify';
    statusBarItem.show();
}

/**
 * Update status bar item
 */
function updateStatusBar() {
    if (!statusBarItem) {
        if (config.showStatusBar) {
            createStatusBarItem();
        }
        return;
    }

    if (!config.showStatusBar) {
        statusBarItem.hide();
        return;
    }

    const isEnabled = config.enabled;
    statusBarItem.text = `$(${isEnabled ? 'bell' : 'bell-slash'}) VibeNotify`;
    statusBarItem.backgroundColor = isEnabled 
        ? undefined 
        : new vscode.ThemeColor('statusBarItem.warningBackground');
    
    statusBarItem.show();
}

/**
 * Check if a document matches chat patterns
 */
function isLikelyChatDocument(document: vscode.TextDocument): boolean {
    const fileName = document.fileName.toLowerCase();
    const chatMatchers = config.chatMatchers;
    
    return chatMatchers.some(matcher => {
        try {
            const regex = new RegExp(matcher.titleRegex, 'i');
            return regex.test(fileName);
        } catch (error) {
            console.warn(`VibeNotify: Invalid regex pattern: ${matcher.titleRegex}`, error);
            return fileName.includes(matcher.titleRegex.toLowerCase());
        }
    });
}

/**
 * Get the current extension state for debugging
 */
export function getExtensionState() {
    return {
        enabled: config?.enabled ?? false,
        monitoring: chatIdleDetector?.getDebugInfo().enabled ?? false,
        lastExtractedCommands: lastExtractedCommands,
        configValues: {
            silenceMs: config?.silenceMs,
            chatMatchers: config?.chatMatchers,
            notifyWithSound: config?.notifyWithSound,
            showStatusBar: config?.showStatusBar,
            terminalName: config?.terminalName,
            useTasks: config?.useTasks,
            autoRevealOnFinish: config?.autoRevealOnFinish
        }
    };
}

/**
 * Manual trigger for testing (not exposed as command)
 */
export async function triggerTestNotification() {
    if (notifier) {
        const activeEditor = vscode.window.activeTextEditor;
        await notifier.showTestNotification(activeEditor?.document);
    }
}

/**
 * Get last extracted commands (for testing)
 */
export function getLastExtractedCommands(): ExtractedCommands | null {
    return lastExtractedCommands;
}

/**
 * Set last extracted commands (for testing)
 */
export function setLastExtractedCommands(commands: ExtractedCommands | null) {
    lastExtractedCommands = commands;
}