import * as path from 'path';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { ThrottledDelayer } from './utils/async';

namespace CommandIds {
    export const runLint: string = 'salt-lint.runLint';
    export const openRuleDoc: string = 'salt-lint.openRuleDoc';
}

interface SaltLintItem {
    id: string;
    message: string;
    filename: string;
    linenumber: number;
    line: string;
    severity: string;
}

function makeDiagnostic(textDocument: vscode.TextDocument, item: SaltLintItem): vscode.Diagnostic {
    let startPos = new vscode.Position(item.linenumber - 1, item.line.search(/\S/));
    let endPos = new vscode.Position(item.linenumber - 1, item.line.length);

    const range = new vscode.Range(startPos, endPos);
    // const severity = levelToDiagnosticSeverity(item.level);
    const severity = vscode.DiagnosticSeverity.Warning;
    const diagnostic = new vscode.Diagnostic(range, item.message, severity);
    diagnostic.source = 'salt-lint';
    diagnostic.code = item.id;
    // diagnostic.tags = scCodeToDiagnosticTags(item.code);
    return diagnostic;
}

export default class SaltLintProvider implements vscode.CodeActionProvider {

    public static LANGUAGE_ID = 'saltstack';
    private channel: vscode.OutputChannel;
    private executableNotFound: boolean;
    private delayers!: { [key: string]: ThrottledDelayer<void> };
    private readonly diagnosticCollection: vscode.DiagnosticCollection;

    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    constructor(private readonly context: vscode.ExtensionContext) {
        this.channel = vscode.window.createOutputChannel('salt-lint');
        this.executableNotFound = false;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        // code actions
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider('saltstack', this, {
                providedCodeActionKinds: SaltLintProvider.providedCodeActionKinds,
            }),
        );

        // commands
        context.subscriptions.push(
            vscode.commands.registerCommand(CommandIds.openRuleDoc, async (url: string) => {
                return await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
            }),
            vscode.commands.registerTextEditorCommand(CommandIds.runLint, async (editor) => {
                return await this.triggerLint(editor.document);
            }),
        );

        this.delayers = Object.create(null);

        // event handlers
        vscode.workspace.onDidOpenTextDocument(this.triggerLint, this, context.subscriptions);
        vscode.workspace.onDidCloseTextDocument((textDocument) => {
            this.diagnosticCollection.delete(textDocument.uri);
            delete this.delayers[textDocument.uri.toString()];
        }, null, context.subscriptions);

        // salt-lint all open SaltStack documents
        vscode.workspace.textDocuments.forEach(this.triggerLint, this);
    }

    public dispose(): void {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
        this.channel.dispose();
    }

    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        const actions: vscode.CodeAction[] = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'salt-lint') {
                continue;
            }

            if (typeof diagnostic.code === 'string') {
                const ruleId = diagnostic.code;
                const title = `Show salt-lint Wiki for ${ruleId}`;
                const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
                action.command = {
                    title: title,
                    command: CommandIds.openRuleDoc,
                    arguments: [`https://github.com/warpnet/salt-lint/wiki/${ruleId}`],
                };
                actions.push(action);
            }
        }

        return actions;
    }

    private isAllowedTextDocument(textDocument: vscode.TextDocument): boolean {
        if (textDocument.languageId === SaltLintProvider.LANGUAGE_ID) {
            return true;
        }

        return false;
    }

    private triggerLint(textDocument: vscode.TextDocument): void {
        this.channel.appendLine(`[DEBUG] tiggerLint`);
        if (this.executableNotFound || !this.isAllowedTextDocument(textDocument)) {
            return;
        }

        const key = textDocument.uri.toString();
        let delayer = this.delayers[key];
        if (!delayer) {
            delayer = new ThrottledDelayer<void>(250);
            this.delayers[key] = delayer;
        }

        delayer.trigger(() => this.runLint(textDocument));
    }

    private runLint(textDocument: vscode.TextDocument): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const executable = 'salt-lint';
            let args = ['--json'];

            let cwd: string | undefined;
            cwd = textDocument.isUntitled ? vscode.workspace.rootPath : path.dirname(textDocument.fileName);
        
            const options = { cwd: cwd };
            const childProcess = cp.spawn(executable, args, options);
            childProcess.on('error', (error: Error) => {
                if (!this.executableNotFound) {
                    this.showSaltLintError(error, executable);
                }

                this.executableNotFound = true;
                path.resolve();
                return;
            });

            if (childProcess.pid) {
                childProcess.stdout.setEncoding('utf-8');

                let state = textDocument.getText();
                childProcess.stdin.write(state);
                childProcess.stdin.end();

                const output: string[] = [];
                childProcess.stdout
                    .on('data', (data: Buffer) => {
                        output.push(data.toString());
                    })
                    .on('end', () => {
                        let diagnostics: vscode.Diagnostic[] = [];
                        if (output.length) {
                            diagnostics = this.parseSaltLintResult(textDocument, output.join(''));
                        }

                        this.diagnosticCollection.set(textDocument.uri, diagnostics);
                        resolve();
                    });
                } else {
                    resolve();
                }
        });
    }

    private parseSaltLintResult(textDocument: vscode.TextDocument, s: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        const items = <SaltLintItem[]>JSON.parse(s);
        for (const item of items) {
            if (item) {
                diagnostics.push(makeDiagnostic(textDocument, item));
            }
        }

        return diagnostics;
    }

    private showSaltLintError(error: any, executable: string): void {
        let message: string;
        if (error.code === 'ENOENT') {
            message = `Cannot salt-lint the Salt State file. The salt-lint program was not found.`;
        } else {
            message = error.message ? error.message : `Failed to run salt-lint using path: ${executable}. Reason is unknown.`;
        }

        vscode.window.showInformationMessage(message);
    }
}