# CodePunk.CopilotDesktop

Minimal cross-platform Avalonia desktop app that provides a chat-style interface over the GitHub Copilot CLI.

This app wraps `copilot chat --json` with a friendly UI and two modes:

- Code Mode – normal Copilot behaviour for programming queries
- Chat Mode – prefixes every message with a system note: `[system note: this is a general, non-coding conversation. Answer conversationally.]`

## Folder Structure

copilotdesktop/
- src/
  - CopilotDesktop/
    - App.axaml, Program.cs
    - Core/ (ChatMessage.cs, ChatMode.cs, ICopilotService.cs)
    - Infrastructure/ (CopilotService.cs, CopilotProcess.cs, ICopilotProcess.cs, ICopilotProcessFactory.cs)
    - UI/ (MainWindow.axaml, MainWindowViewModel.cs, ChatViewModel.cs)
- tests/
  - CopilotDesktop.Tests/
    - CopilotServiceTests.cs, ModeSwitchingTests.cs, PersistentSessionTests.cs

## Prerequisites

- .NET 9 SDK
- GitHub Copilot CLI installed and authenticated (`copilot auth login`)

## Build and Run

- From `copilotdesktop/`:
  - `dotnet build CodePunk.CopilotDesktop.sln`
  - `dotnet run --project src/CopilotDesktop`

## Tests

- From `copilotdesktop/`:
  - `dotnet test CodePunk.CopilotDesktop.sln`

## UI Basics

- Scrollable chat history with user/assistant message bubbles
- Multi-line input: Enter to send, Shift+Enter for new line
- Toggle between Code and Chat using the header switch
- While streaming, a typing indicator appears

## How It Works

- `ICopilotService` defines: `IAsyncEnumerable<string> StreamResponseAsync(string prompt, ChatMode mode)`
- `CopilotService` maintains a persistent `copilot chat --json` session, writes prompts, and streams stdout JSON events into text chunks until a `done` event
- In Chat mode, the prompt is prefixed with the system note
- The UI appends streamed chunks to an assistant message in real time and renders Markdown for assistant messages

## Example Interaction

1. Select Chat mode
2. Ask: "What’s a good productivity tip?"
3. Watch the response stream in the assistant bubble

## Notes

- Logging via the generic host; console output logs process lifecycle and errors
- Process layer is abstracted (ICopilotProcess) for testability; tests use fakes to simulate streaming
- Cross-platform (Windows/macOS/Linux) via Avalonia

