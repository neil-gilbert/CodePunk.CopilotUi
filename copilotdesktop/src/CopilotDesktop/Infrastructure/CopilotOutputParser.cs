using System;

namespace CodePunk.CopilotDesktop.Infrastructure;

/// <summary>
/// Parser for Copilot CLI output. Handles plain text/markdown output from interactive mode.
/// </summary>
internal static class CopilotOutputParser
{
    /// <summary>
    /// Parses a single output line from the Copilot CLI.
    /// </summary>
    internal static bool TryParse(string line, out string? chunk)
    {
        chunk = null;

        if (string.IsNullOrWhiteSpace(line)) 
            return false;

        // Copilot CLI in interactive mode outputs plain text/markdown
        chunk = line + "\n";
        return true;
    }
}
