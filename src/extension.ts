import * as vscode from 'vscode';
import SaltLintProvider from './linter';

export function activate(context: vscode.ExtensionContext) {
	const linter = new SaltLintProvider(context);
	context.subscriptions.push(linter);
}

export function deactivate(): void {}