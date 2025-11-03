using System.Collections.Generic;
using System.Linq;
using CodePunk.CopilotDesktop.Core;

namespace CopilotDesktop.Tests.Utilities;

internal sealed class FakeCopilotService : ICopilotService
{
    private readonly Queue<string[]> _queue = new();

    public void Enqueue(params string[] chunks) => _queue.Enqueue(chunks);

    public async IAsyncEnumerable<string> StreamResponseAsync(string prompt, ChatMode mode)
    {
        if (_queue.Count == 0) yield break;
        foreach (var chunk in _queue.Dequeue())
            yield return chunk;
        await System.Threading.Tasks.Task.CompletedTask;
    }
    
    public void ClearHistory()
    {
        // No-op for fake implementation
    }
}

