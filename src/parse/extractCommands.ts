export type ShellLanguage = 'bash' | 'sh' | 'zsh' | 'powershell' | 'pwsh' | 'cmd';

export interface ExtractedCommands {
    commands: string[];
    languageHint: ShellLanguage | null;
    rawBlocks: Array<{
        language: string;
        content: string;
        startIndex: number;
        endIndex: number;
    }>;
}

/**
 * Extract shell commands from text content, focusing on fenced code blocks
 * @param text The text content to parse
 * @param recentTextOnly If true, prioritize the most recent code blocks
 * @returns Extracted commands with language hints
 */
export function extractCommands(text: string, recentTextOnly: boolean = true): ExtractedCommands {
    const result: ExtractedCommands = {
        commands: [],
        languageHint: null,
        rawBlocks: []
    };

    // Regex to match fenced code blocks with language identifiers
    const fencedBlockRegex = /```([a-zA-Z]*)?\n([\s\S]*?)```/g;
    const shellLanguages: ShellLanguage[] = ['bash', 'sh', 'zsh', 'powershell', 'pwsh', 'cmd'];
    
    let match;
    const blocks: Array<{
        language: string;
        content: string;
        startIndex: number;
        endIndex: number;
    }> = [];

    // Extract all fenced code blocks
    while ((match = fencedBlockRegex.exec(text)) !== null) {
        const language = (match[1] || '').toLowerCase();
        const content = match[2]?.trim();
        
        if (content) {
            blocks.push({
                language,
                content,
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
    }

    // Filter blocks that match shell languages
    const shellBlocks = blocks.filter(block => 
        shellLanguages.includes(block.language as ShellLanguage)
    );

    // If no explicit shell blocks, look for blocks that might contain shell commands
    let candidateBlocks = shellBlocks;
    if (candidateBlocks.length === 0) {
        // Look for blocks without language or with generic identifiers that might contain shell commands
        candidateBlocks = blocks.filter(block => 
            !block.language || 
            ['text', 'plain', 'terminal', 'console', 'shell'].includes(block.language)
        ).filter(block => looksLikeShellCommands(block.content));
    }

    // If still no candidates, look for blocks preceded by execution keywords
    if (candidateBlocks.length === 0) {
        candidateBlocks = blocks.filter(block => {
            const beforeBlock = text.substring(Math.max(0, block.startIndex - 200), block.startIndex);
            const executionKeywords = /\b(run|execute|command|terminal|shell|type|enter)\b/i;
            return executionKeywords.test(beforeBlock) && looksLikeShellCommands(block.content);
        });
    }

    result.rawBlocks = candidateBlocks;

    if (candidateBlocks.length === 0) {
        return result;
    }

    // If recentTextOnly is true, prefer the last block
    const targetBlocks = recentTextOnly ? [candidateBlocks[candidateBlocks.length - 1]].filter(Boolean) : candidateBlocks;
    
    // Extract and clean commands from the selected blocks
    for (const block of targetBlocks) {
        if (block) {
            const commands = parseCommandsFromBlock(block.content);
            result.commands.push(...commands);
            
            // Set language hint from the first block with a recognized shell language
            if (!result.languageHint && shellLanguages.includes(block.language as ShellLanguage)) {
                result.languageHint = block.language as ShellLanguage;
            }
        }
    }

    // If no explicit language hint, try to infer from command patterns
    if (!result.languageHint && result.commands.length > 0) {
        result.languageHint = inferShellLanguage(result.commands);
    }

    return result;
}

/**
 * Check if content looks like shell commands
 */
function looksLikeShellCommands(content: string): boolean {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length === 0) return false;

    // Common shell command patterns
    const shellPatterns = [
        /^(npm|yarn|pnpm|bun)\s+/,           // Package managers
        /^(git|docker|kubectl)\s+/,          // Common CLI tools
        /^(ls|cd|mkdir|rm|cp|mv|cat|grep|find|curl|wget)\b/,  // Unix commands
        /^(dir|copy|move|del|type)\b/,       // Windows commands
        /^[a-zA-Z][a-zA-Z0-9_-]*\s+/,       // Generic command pattern
        /^\$\s+/,                            // Shell prompt
        /^PS\s*>\s*/,                        // PowerShell prompt
        /^C:\\.*>\s*/,                       // CMD prompt
    ];

    const commandLikeLines = lines.filter(line => 
        shellPatterns.some(pattern => pattern.test(line))
    );

    // If more than half the lines look like commands, consider it shell content
    return commandLikeLines.length / lines.length > 0.5;
}

/**
 * Parse individual commands from a code block
 */
function parseCommandsFromBlock(content: string): string[] {
    const lines = content.split('\n');
    const commands: string[] = [];

    for (let line of lines) {
        line = line.trim();
        
        // Skip empty lines and comments
        if (!line || line.startsWith('#') || line.startsWith('//')) {
            continue;
        }

        // Remove common shell prompts
        line = line.replace(/^\$\s+/, '');           // Bash/sh prompt
        line = line.replace(/^PS\s*>\s*/, '');       // PowerShell prompt
        line = line.replace(/^C:\\.*>\s*/, '');      // CMD prompt
        line = line.replace(/^>\s+/, '');            // Generic prompt
        
        // Skip lines that are just prompts or output
        if (!line) continue;
        
        // Skip lines that look like output (start with common output patterns)
        if (/^(\s*\||\s*\+|\s*-|\s*\*|\s*>|\s*<)/.test(line)) {
            continue;
        }

        commands.push(line);
    }

    return commands;
}

/**
 * Infer shell language from command patterns
 */
function inferShellLanguage(commands: string[]): ShellLanguage | null {
    const allCommands = commands.join(' ').toLowerCase();

    // PowerShell indicators
    if (/\b(get-|set-|new-|remove-|invoke-|test-|start-|stop-)/.test(allCommands) ||
        /\$\w+\s*=/.test(allCommands) ||
        /\[.*\]/.test(allCommands)) {
        return 'powershell';
    }

    // CMD indicators
    if (/\b(dir|copy|move|del|type|echo\s+off|set\s+\w+=)/.test(allCommands)) {
        return 'cmd';
    }

    // Default to bash for Unix-like commands
    if (/\b(ls|cd|mkdir|rm|cp|mv|cat|grep|find|chmod|chown)/.test(allCommands)) {
        return 'bash';
    }

    // If we can't determine, default to bash
    return 'bash';
}

/**
 * Extract commands from recent text changes (diff-like)
 * @param oldText Previous text content
 * @param newText Current text content
 * @returns Extracted commands from the newly added content
 */
export function extractCommandsFromDiff(oldText: string, newText: string): ExtractedCommands {
    // Simple approach: if newText is longer, extract from the difference
    if (newText.length > oldText.length) {
        const diffText = newText.substring(oldText.length);
        return extractCommands(diffText, true);
    }
    
    // If text was replaced or shortened, analyze the entire new text
    return extractCommands(newText, true);
}

/**
 * Get a user-friendly description of extracted commands
 */
export function getCommandDescription(extracted: ExtractedCommands): string {
    if (extracted.commands.length === 0) {
        return 'No commands found';
    }

    const commandCount = extracted.commands.length;
    const language = extracted.languageHint || 'shell';
    
    if (commandCount === 1) {
        const cmd = extracted.commands[0];
        if (cmd) {
            const shortCmd = cmd.length > 50 ? cmd.substring(0, 47) + '...' : cmd;
            return `Run ${language} command: ${shortCmd}`;
        }
    }
    
    return `Run ${commandCount} ${language} commands`;
}