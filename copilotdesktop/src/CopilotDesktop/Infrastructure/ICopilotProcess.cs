using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace CodePunk.CopilotDesktop.Infrastructure;

/// <summary>
/// Abstraction over the GitHub Copilot CLI process for testability.
/// </summary>
public interface ICopilotProcess : IAsyncDisposable
{
    /// <summary>
    /// Starts the underlying process.
    /// </summary>
    Task StartAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Writes a prompt to the process standard input.
    /// </summary>
    Task WritePromptAsync(string prompt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads output lines asynchronously from the process.
    /// </summary>
    IAsyncEnumerable<string> ReadOutputLinesAsync(CancellationToken cancellationToken = default);
    event EventHandler? Exited;
    bool IsRunning { get; }
}

