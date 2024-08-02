const vscode = require("vscode");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

// Constants
const COMMAND_NAME = "commit-message.iniciarCommit";
const NO_WORKSPACE_ERROR = "Nenhum workspace aberto.";
const NO_DIFF_MESSAGE = "Não há diferenças para commitar.";
const GIT_DIFF_ERROR = "Error to execute the git diff command:";

// Activate extension
function activate(context) {
  console.log('Extension "commit-message" is activated!');

  let disposable = vscode.commands.registerCommand(
    COMMAND_NAME,
    handleCommitMessageCommand
  );

  context.subscriptions.push(disposable);
}

// Handle the commit message command
async function handleCommitMessageCommand() {
  try {
    const workspaceFolder = getWorkspaceFolder();
    const gitDiffOutput = await getGitDiffOutput(workspaceFolder.uri.fsPath);

    if (!gitDiffOutput.trim()) {
      vscode.window.showInformationMessage(NO_DIFF_MESSAGE);
      return;
    }

    await showDiffInNewDocument(gitDiffOutput);
    vscode.window.showInformationMessage("New commit message generated!");
  } catch (error) {
    handleError(error);
  }
}

// Get the current workspace folder
function getWorkspaceFolder() {
  const workspaceFolder =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!workspaceFolder) {
    throw new Error(NO_WORKSPACE_ERROR);
  }
  return workspaceFolder;
}

// Execute git diff command and return the output
async function getGitDiffOutput(cwd) {
  const { stdout, stderr } = await execPromise("git diff", { cwd });
  if (stderr) {
    console.error("Git diff stderr:", stderr);
  }
  return stdout;
}

// Show the git diff output in a new untitled document
async function showDiffInNewDocument(content) {
  const document = await vscode.workspace.openTextDocument({
    content,
    language: "diff",
  });
  await vscode.window.showTextDocument(document);
}

// Handle errors
function handleError(error) {
  vscode.window.showErrorMessage(`${GIT_DIFF_ERROR} ${error.message}`);
  console.error("Detailed Error:", error);
}

// Deactivate extension
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
