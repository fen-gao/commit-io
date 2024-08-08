const vscode = require("vscode");
const { exec } = require("child_process");
const util = require("util");
const axios = require("axios");
const execPromise = util.promisify(exec);

// Constants
const COMMAND_NAME = "commit-message.iniciarCommit";
const NO_WORKSPACE_ERROR = "No workspace folder found!";
const NO_DIFF_MESSAGE = "Not found any changes to commit.";
const GIT_DIFF_ERROR = "Error to execute the git diff command:";

// Commit types
const COMMIT_TYPES = [
  { label: "feat", description: "A new feature" },
  { label: "fix", description: "A bug fix" },
  { label: "docs", description: "Documentation only changes" },
  {
    label: "style",
    description: "Changes that do not affect the meaning of the code",
  },
  {
    label: "refactor",
    description: "A code change that neither fixes a bug nor adds a feature",
  },
  { label: "perf", description: "A code change that improves performance" },
  {
    label: "test",
    description: "Adding missing tests or correcting existing tests",
  },
  {
    label: "build",
    description:
      "Changes that affect the build system or external dependencies",
  },
  {
    label: "ci",
    description: "Changes to our CI configuration files and scripts",
  },
];

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

    const useAI = await askUseAI();
    const commitType = await selectCommitType();

    let scope = "";
    let shortDescription = "";
    let longDescription = "";

    if (useAI) {
      const modifiedFiles = await getModifiedFiles(workspaceFolder.uri.fsPath);
      scope = modifiedFiles.length === 1 ? modifiedFiles[0] : "";

      try {
        const aiResponse = await generateCommitMessage(
          gitDiffOutput,
          commitType,
          scope
        );
        if (aiResponse) {
          [shortDescription, longDescription] = aiResponse.split("\n\n", 2);
        } else {
          throw new Error("AI failed to generate a commit message");
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error generating commit message: ${error.message}`
        );
        // Fallback to manual input if AI fails
        shortDescription = await inputShortDescription();
        longDescription = await inputLongDescription();
      }
    } else {
      scope = await selectScope();
      shortDescription = await inputShortDescription();
      longDescription = await inputLongDescription();
    }

    const breakingChanges = await inputBreakingChanges();

    const commitMessage = formatCommitMessage(
      commitType,
      scope,
      shortDescription,
      longDescription,
      breakingChanges
    );

    await showCommitMessageInNewDocument(commitMessage);
    vscode.window.showInformationMessage("New commit message generated!");
  } catch (error) {
    handleError(error);
  }
}

async function askUseAI() {
  const choice = await vscode.window.showQuickPick(
    ["Yes, use AI assistance", "No, I'll write manually"],
    { placeHolder: "Do you want to use AI assistance for the commit message?" }
  );
  return choice === "Yes, use AI assistance";
}

async function selectCommitType() {
  const selected = await vscode.window.showQuickPick(COMMIT_TYPES, {
    placeHolder: "Select the type of change that you're committing",
  });
  return selected ? selected.label : "";
}

async function selectScope() {
  const scopes = ["None", "New scope", "New scope (only use once)"];
  const selected = await vscode.window.showQuickPick(scopes, {
    placeHolder: "Select the scope of this change",
  });
  if (selected === "New scope" || selected === "New scope (only use once)") {
    return await vscode.window.showInputBox({
      prompt: "Enter the new scope",
    });
  }
  return selected === "None" ? "" : selected;
}

async function inputShortDescription() {
  return await vscode.window.showInputBox({
    prompt: "Write a short, imperative tense description of the change",
  });
}

async function inputLongDescription() {
  return await vscode.window.showInputBox({
    prompt: "Provide a longer description of the change (optional)",
    multiline: true,
  });
}

async function generateCommitMessage(gitDiffOutput, commitType, scope) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/engines/davinci-codex/completions",
      {
        prompt: `Generate a commit message for the following git diff, using the commit type "${commitType}" ${
          scope ? `and scope "${scope}"` : ""
        }:\n\n${gitDiffOutput}\n\nCommit message:`,
        max_tokens: 200,
        n: 1,
        stop: null,
        temperature: 0.5,
      },
      {
        headers: {
          Authorization: `Bearer YOUR_API_KEY_HERE`, // Substitua pela sua chave de API real
          "Content-Type": "application/json",
        },
      }
    );

    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      return response.data.choices[0].text.trim();
    } else {
      throw new Error("Unexpected API response format");
    }
  } catch (error) {
    console.error("Error generating commit message:", error);
    if (error.response) {
      console.error("API response:", error.response.data);
    }
    throw new Error("Failed to generate commit message");
  }
}

async function inputBreakingChanges() {
  return await vscode.window.showInputBox({
    prompt:
      "List any breaking changes or issues closed by this change (optional)",
  });
}

function formatCommitMessage(
  type,
  scope,
  shortDesc,
  longDesc,
  breakingChanges
) {
  let message = `${type}${
    scope ? `(${scope})` : ""
  }: ${shortDesc}\n\n${longDesc}`;
  if (breakingChanges) {
    message += `\n\nBREAKING CHANGES: ${breakingChanges}`;
  }
  return message;
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

async function getModifiedFiles(cwd) {
  const { stdout } = await execPromise("git diff --name-only", { cwd });
  return stdout.trim().split("\n");
}

// Show the commit message in a new untitled document
async function showCommitMessageInNewDocument(content) {
  const document = await vscode.workspace.openTextDocument({
    content,
    language: "plaintext",
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
