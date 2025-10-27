using System.Collections.Generic;

namespace CodePunk.CopilotDesktop.Core;

/// <summary>
/// Provides streaming access to GitHub Copilot CLI responses.
/// </summary>
public interface ICopilotService
{
    /// <summary>
    /// Streams the response from Copilot CLI for the given prompt and mode.
    /// </summary>
    /// <param name="prompt">The user prompt to send.</param>
    /// <param name="mode">Interaction mode.</param>
    /// <returns>Streaming sequence of response chunks.</returns>
    IAsyncEnumerable<string> StreamResponseAsync(string prompt, ChatMode mode);
}
