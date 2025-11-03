using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CodePunk.CopilotDesktop.Core;
using Microsoft.Extensions.Logging;

namespace CodePunk.CopilotDesktop.Infrastructure;

/// <summary>
/// Streams responses from the Copilot CLI process.
/// </summary>
public sealed class CopilotService : ICopilotService
{
    private const string ChatPrefix = "[system note: this is a general, non-coding conversation. Answer conversationally.]";
    private readonly ILogger<CopilotService> _logger;
    private readonly ICopilotProcessFactory _factory;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private ICopilotProcess? _process;
    
    // Track if this is the first message (to start a new session) or continuation
    private bool _isFirstMessage = true;

    public CopilotService(ILogger<CopilotService> logger, ICopilotProcessFactory factory)
    {
        _logger = logger;
        _factory = factory;
    }

    public async IAsyncEnumerable<string> StreamResponseAsync(string prompt, ChatMode mode)
    {
        // Build prompt with system message for chat mode
        var finalPrompt = mode == ChatMode.Chat
            ? $"{ChatPrefix}\n\n{prompt}\n\nIMPORTANT: After you have finished your complete response, type exactly '--done' on a new line by itself."
            : $"{prompt}\n\nIMPORTANT: After you have finished your complete response, type exactly '--done' on a new line by itself.";

        await _semaphore.WaitAsync();
        try
        {
            // Create a new process for each request
            // First message starts a new session, subsequent messages continue it
            var sessionMode = _isFirstMessage ? "new session" : "continuing session";
            _logger.LogInformation("Creating Copilot process for {Mode} - {SessionMode}", mode, sessionMode);
            _logger.LogDebug("Full prompt: {Prompt}", finalPrompt);
            
            var process = _factory.Create();
            if (process is CopilotProcess cp)
            {
                // Use --continue flag for subsequent messages to maintain context
                cp.SetPrompt(finalPrompt, useContinue: !_isFirstMessage);
            }
            
            await process.StartAsync();
            _logger.LogInformation("Process started, reading response...");
            
            // After first message, all subsequent ones will continue the session
            _isFirstMessage = false;

            var lineCount = 0;
            var responseBuilder = new System.Text.StringBuilder();
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120)); // 2 minute timeout
            
            await foreach (var line in process.ReadOutputLinesAsync().WithCancellation(cts.Token))
            {
                lineCount++;
                _logger.LogDebug("Received line #{Count}: '{Line}'", lineCount, line);
                
                // Check for authentication prompts or errors
                if (line.Contains("not authenticated", StringComparison.OrdinalIgnoreCase) ||
                    line.Contains("login", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("Authentication may be required: {Line}", line);
                }
                
                // Check for our done marker
                if (line.Trim().Equals("--done", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogDebug("Detected --done marker, response complete");
                    break;
                }
                
                if (!CopilotOutputParser.TryParse(line, out var chunk))
                    continue;

                if (!string.IsNullOrEmpty(chunk))
                {
                    responseBuilder.Append(chunk);
                    yield return chunk!;
                }
            }
            
            _logger.LogInformation("Response stream ended. Total lines received: {Count}", lineCount);
            
            // Clean up the process
            await process.DisposeAsync();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    private async Task EnsureProcessAsync()
    {
        if (_process is { IsRunning: true }) return;

        if (_process is not null)
        {
            await _process.DisposeAsync();
            _process = null;
        }

        _logger.LogInformation("Starting persistent Copilot CLI process...");
        _process = _factory.Create();
        _process.Exited += OnProcessExited;
        await _process.StartAsync();
    }

    private void OnProcessExited(object? sender, EventArgs e)
    {
        _logger.LogWarning("Copilot process exited");
    }

    private async Task ResetProcessAsync()
    {
        if (_process is null) return;
        try { await _process.DisposeAsync(); }
        catch { }
        finally { _process = null; }
    }
    
    public void ClearHistory()
    {
        // Reset to start a new session
        _isFirstMessage = true;
        _logger.LogInformation("Conversation session reset - next message will start a new session");
    }
}

