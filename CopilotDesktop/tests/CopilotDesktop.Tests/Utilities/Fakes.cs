using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using CodePunk.CopilotDesktop.Infrastructure;

namespace CopilotDesktop.Tests.Utilities;

internal sealed class FakeCopilotProcess : ICopilotProcess
{
    private readonly Channel<string> _channel = Channel.CreateUnbounded<string>();
    private readonly List<string> _prompts = new();
    private bool _started;

    public event EventHandler? Exited;

    public IReadOnlyList<string> Prompts => _prompts;
    public bool IsRunning => _started;

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        _started = true;
        return Task.CompletedTask;
    }

    public Task WritePromptAsync(string prompt, CancellationToken cancellationToken = default)
    {
        _prompts.Add(prompt);
        return Task.CompletedTask;
    }

    public async IAsyncEnumerable<string> ReadOutputLinesAsync(CancellationToken cancellationToken = default)
    {
        var reader = _channel.Reader;
        while (await reader.WaitToReadAsync(cancellationToken))
        {
            while (reader.TryRead(out var line))
            {
                yield return line;
            }
        }
    }

    public void Enqueue(params string[] lines)
    {
        foreach (var line in lines)
            _channel.Writer.TryWrite(line);
    }

    public void TriggerExit()
    {
        _started = false;
        Exited?.Invoke(this, EventArgs.Empty);
    }

    public ValueTask DisposeAsync()
    {
        _channel.Writer.TryComplete();
        return ValueTask.CompletedTask;
    }
}

internal sealed class FakeCopilotProcessFactory : ICopilotProcessFactory
{
    private readonly Queue<ICopilotProcess> _queue = new();

    public void Enqueue(ICopilotProcess process) => _queue.Enqueue(process);

    public ICopilotProcess Create()
    {
        if (_queue.Count == 0) throw new InvalidOperationException("No fake processes queued");
        return _queue.Dequeue();
    }
}

