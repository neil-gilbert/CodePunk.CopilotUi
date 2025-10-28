using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace CodePunk.CopilotDesktop.Infrastructure;

/// <summary>
/// Wraps the GitHub Copilot CLI process (copilot chat --json) and exposes asynchronous line streaming.
/// </summary>
public sealed class CopilotProcess : ICopilotProcess
{
    private readonly string _fileName;
    private readonly string _arguments;
    private Process? _process;
    private Channel<string>? _outputChannel;
    private CancellationTokenSource? _readCts;

    public event EventHandler? Exited;
    public bool IsRunning => _process is { HasExited: false };

    public CopilotProcess(string fileName = "copilot", string arguments = "chat --json")
    {
        _fileName = fileName;
        _arguments = arguments;
    }

    /// <summary>
    /// Starts the copilot process and begins reading output.
    /// </summary>
    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_process != null && !_process.HasExited)
            return;

        _outputChannel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

        _readCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

        var psi = new ProcessStartInfo
        {
            FileName = _fileName,
            Arguments = _arguments,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        _process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        _process.Exited += (_, __) => Exited?.Invoke(this, EventArgs.Empty);
        _process.Start();

        _ = Task.Run(() => ReadLinesAsync(_process.StandardOutput, _readCts.Token));
        _ = Task.Run(() => ReadLinesAsync(_process.StandardError, _readCts.Token));

        await Task.CompletedTask;
    }

    public async Task WritePromptAsync(string prompt, CancellationToken cancellationToken = default)
    {
        if (_process == null)
            throw new InvalidOperationException("Process not started.");

        await _process.StandardInput.WriteLineAsync(prompt.AsMemory(), cancellationToken);
        await _process.StandardInput.FlushAsync();
    }

    public async IAsyncEnumerable<string> ReadOutputLinesAsync([EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (_outputChannel == null)
            yield break;

        var reader = _outputChannel.Reader;
        while (await reader.WaitToReadAsync(cancellationToken).ConfigureAwait(false))
        {
            while (reader.TryRead(out var line))
            {
                yield return line;
            }
        }
    }

    /// <summary>
    /// Reads lines from the provided stream and forwards them to the output channel.
    /// </summary>
    private async Task ReadLinesAsync(StreamReader reader, CancellationToken token)
    {
        if (_outputChannel == null) return;
        try
        {
            while (!reader.EndOfStream && !token.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(token).ConfigureAwait(false);
                if (line is null) break;
                await _outputChannel.Writer.WriteAsync(line, token).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException)
        { }
        catch (Exception ex)
        {
            try { await _outputChannel.Writer.WriteAsync($"[error] {ex.Message}", token).ConfigureAwait(false); }
            catch { }
        }
        finally
        {
            _outputChannel?.Writer.TryComplete();
        }
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            _readCts?.Cancel();
            if (_process != null && !_process.HasExited)
            {
                try { _process.Kill(entireProcessTree: true); }
                catch { }
            }
        }
        finally
        {
            _readCts?.Dispose();
            _process?.Dispose();
            await Task.CompletedTask;
        }
    }
}

public sealed class CopilotProcessFactory : ICopilotProcessFactory
{
    public ICopilotProcess Create() => new CopilotProcess();
}

