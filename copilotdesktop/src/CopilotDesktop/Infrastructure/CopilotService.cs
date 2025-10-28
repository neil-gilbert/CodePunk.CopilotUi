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

    public CopilotService(ILogger<CopilotService> logger, ICopilotProcessFactory factory)
    {
        _logger = logger;
        _factory = factory;
    }

    public async IAsyncEnumerable<string> StreamResponseAsync(string prompt, ChatMode mode)
    {
        var finalPrompt = mode == ChatMode.Chat
            ? $"{ChatPrefix} {prompt}"
            : prompt;

        await _semaphore.WaitAsync();
        try
        {
            await EnsureProcessAsync();

            _logger.LogInformation("Sending prompt to Copilot process (mode: {Mode})", mode);
            await _process!.WritePromptAsync(finalPrompt);

            await foreach (var line in _process.ReadOutputLinesAsync())
            {
                if (!CopilotJsonParser.TryParse(line, out var chunk, out var isDone, out var jsonError))
                    continue;

                if (!string.IsNullOrEmpty(jsonError))
                {
                    _logger.LogWarning("Copilot reported error: {Error}", jsonError);
                }

                if (!string.IsNullOrEmpty(chunk))
                {
                    yield return chunk!;
                }

                if (isDone)
                {
                    _logger.LogDebug("Answer complete");
                    break;
                }
            }
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
}

