import * as vscode from 'vscode';
import { execFile } from 'child_process';

// --- Minimal typings for the built-in Git extension API ---
interface GitExtension {
  getAPI(version: 1): GitAPI;
}
interface GitAPI {
  repositories: Repository[];
  onDidOpenRepository: vscode.Event<Repository>;
}
interface Repository {
  state: RepositoryState;
}
interface RepositoryState {
  HEAD: Branch | undefined;
  onDidChange: vscode.Event<void>;
}
interface Branch {
  name?: string;
  ahead?: number;
}

// Add / edit your own lines here
const funnyLines = [
  'Pushed it. Pray it builds.',
  'YOLO to main.',
  'Code sent. Regret pending.',
  'Another one bites the repo.',
  'Ship it and pray.',
  'git push --force-of-habit',
  'CI is judging you right now.'
];

const previousAhead = new Map<string, number>();

export function activate(context: vscode.ExtensionContext) {
  console.log('Push Celebration: extension activated');
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
  if (!gitExtension) {
    console.log('Push Celebration: vscode.git extension not found.');
    return;
  }

  console.log('Push Celebration: git extension found, getting API');
  const git = gitExtension.getAPI(1);
  console.log('Push Celebration: found', git.repositories.length, 'repositories');

  function watchRepo(repo: Repository) {
    console.log('Push Celebration: watching repo');
    
    // Check initial state
    const head = repo.state.HEAD;
    if (head?.name) {
      console.log(`Push Celebration: initial state - branch='${head.name}', ahead=${head.ahead ?? 0}`);
    }

    repo.state.onDidChange(() => {
      console.log('Push Celebration: onDidChange fired');
      const head = repo.state.HEAD;
      console.log(`Push Celebration: HEAD=${head?.name}, ahead=${head?.ahead}`);
      
      if (!head || !head.name) {
        console.log('Push Celebration: no HEAD or branch name');
        return;
      }

      const key = head.name;
      const ahead = head.ahead ?? 0;
      const prev = previousAhead.get(key) ?? -1;

      console.log(`Push Celebration: branch='${key}', prev ahead=${prev}, current ahead=${ahead}`);

      // Trigger if
      // 1. ahead count drops to 0 (prev > 0 and ahead === 0)
      // 2. OR if ahead is 0 and was previously undefined/unknown (first time seeing this branch)
      if ((prev > 0 && ahead === 0) || (prev === -1 && ahead === 0)) {
        console.log('Push Celebration: TRIGGERED - celebrating now!');
        triggerPushCelebration(context);
      }
      previousAhead.set(key, ahead);
    });
  }

  git.repositories.forEach(watchRepo);
  context.subscriptions.push(git.onDidOpenRepository(watchRepo));

  // Handy for testing without doing a real push
  context.subscriptions.push(
    vscode.commands.registerCommand('pushCelebration.test', () => triggerPushCelebration(context))
  );
}

function triggerPushCelebration(context: vscode.ExtensionContext) {
  void playCelebrationSound(context);

  const panel = vscode.window.createWebviewPanel(
    'pushCelebration',
    'Push Complete!!',
    { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    }
  );

  const imageUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'image.jpg')
  );
  const line = funnyLines[Math.floor(Math.random() * funnyLines.length)];

  panel.webview.html = getWebviewContent(panel.webview.cspSource, imageUri.toString(), line);

  // auto-close after the popup has had its moment
  setTimeout(() => panel.dispose(), 3500);
}

function playCelebrationSound(context: vscode.ExtensionContext): void {
  if (process.platform !== 'darwin') {
    console.log('Push Celebration: sound playback is currently implemented for macOS only.');
    return;
  }

  const audioPath = context.asAbsolutePath('media/audio.mp3');
  execFile('afplay', [audioPath], (error) => {
    if (error) {
      console.error('Push Celebration: failed to play sound:', error);
    }
  });
}

function getWebviewContent(cspSource: string, imageSrc: string, line: string): string {
  return /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'unsafe-inline';" />
<style>
  html, body {
    height: 100%;
    margin: 1;
    background: transparent;
    overflow: hidden;
  }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  img {
    max-width: 220px;
    max-height: 220px;
    animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  p {
    font-size: 18px;
    font-family: var(--vscode-font-family, sans-serif);
    color: var(--vscode-editor-foreground);
    margin-top: 14px;
    opacity: 0;
    animation: fadeIn 0.6s ease-in forwards;
    animation-delay: 0.3s;
  }
  @keyframes pop {
    0%   { transform: scale(0);   opacity: 0; }
    60%  { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
</head>
<body>
  <img src="${imageSrc}" alt="push celebration" />
  <p>${line}</p>
</body>
</html>`;
}

export function deactivate() {}
