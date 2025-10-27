# CodePunk.CopilotDesktop

Minimal cross-platform Avalonia desktop app that provides a chat-style interface over the GitHub Copilot CLI.

This app wraps `copilot chat --json` with a friendly UI and two modes:

- 💻 Code Mode – normal Copilot behaviour for programming queries
- 💬 Chat Mode – prefixes every message with a system note: `[system note: this is a general, non-coding conversation. Answer conversationally.]`

## Folder Structure

CopilotDesktop/
- Core/
  - ChatMessage.cs, ChatMode.cs, ICopilotService.cs
- Infrastructure/
  - CopilotService.cs, CopilotProcess.cs, ICopilotProcess.cs, ICopilotProcessFactory.cs
- UI/
  - MainWindow.axaml, MainWindowViewModel.cs, ChatViewModel.cs
- App.axaml, Program.cs

Tests/
- CopilotDesktop.Tests/
  - CopilotServiceTests.cs, ModeSwitchingTests.cs

## Prerequisites

- .NET 9 SDK
- GitHub Copilot CLI installed and authenticated (`copilot auth login`)

## Build and Run

- Restore and run:
  - `dotnet build`
  - `dotnet run --project CopilotDesktop`

## Tests

- Run tests from the repo root:
  - `dotnet test`

## UI Basics

- Scrollable chat history with user/assistant message bubbles
- Multi-line input: Enter to send, Shift+Enter for new line
- Toggle between 💻 Code and 💬 Chat using the header switch
- While streaming, a typing indicator appears

## How It Works

- `ICopilotService` defines a single method: `IAsyncEnumerable<string> StreamResponseAsync(string prompt, ChatMode mode)`
- `CopilotService` launches a fresh `copilot chat --json` process per request, writes the prompt to stdin, and streams stdout lines
- In Chat mode, the prompt is prefixed with the system note to steer general conversation
- The UI appends streamed chunks to an assistant message in real time

## Example Interaction

1. Select 💬 Chat mode
2. Ask: "What’s a good productivity tip?"
3. Watch the response stream in the assistant bubble

## Notes

- Logging is configured via the generic host; console output logs process lifecycle and errors
- The process layer is abstracted (ICopilotProcess) for testability; tests use fakes to simulate streaming
- Everything is cross-platform (Windows/macOS/Linux) via Avalonia

