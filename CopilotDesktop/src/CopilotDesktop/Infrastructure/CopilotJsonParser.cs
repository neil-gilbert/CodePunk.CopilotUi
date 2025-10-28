using System;
using System.Text.Json;

namespace CodePunk.CopilotDesktop.Infrastructure;

/// <summary>
/// Minimal JSON line parser for "copilot chat --json" output. Extracts streaming text chunks and detects end-of-answer events.
/// </summary>
internal static class CopilotJsonParser
{
    /// <summary>
    /// Parses a single output line, extracting a text chunk, a done marker, and an error string when present.
    /// </summary>
    internal static bool TryParse(string line, out string? chunk, out bool isDone, out string? error)
    {
        chunk = null;
        isDone = false;
        error = null;

        if (string.IsNullOrWhiteSpace(line)) return false;

        try
        {
            using var doc = JsonDocument.Parse(line);
            var root = doc.RootElement;
            if (root.TryGetProperty("error", out var errElem))
            {
                error = errElem.ValueKind == JsonValueKind.String ? errElem.GetString() : errElem.ToString();
            }
            if (root.TryGetProperty("done", out var doneElem) && doneElem.ValueKind == JsonValueKind.True)
                {
                    isDone = true;
                }
            else if (root.TryGetProperty("type", out var typeElem) && typeElem.ValueKind == JsonValueKind.String)
            {
                var t = typeElem.GetString();
                if (string.Equals(t, "done", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(t, "final", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(t, "assistant_message_end", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(t, "stop", StringComparison.OrdinalIgnoreCase))
                {
                    isDone = true;
                }
            }
            if (root.TryGetProperty("delta", out var deltaElem) && deltaElem.ValueKind == JsonValueKind.String)
            {
                chunk = deltaElem.GetString();
                return true;
            }
            if (root.TryGetProperty("text", out var textElem) && textElem.ValueKind == JsonValueKind.String)
            {
                chunk = textElem.GetString();
                return true;
            }
            if (root.TryGetProperty("message", out var msgElem) && msgElem.ValueKind == JsonValueKind.Object)
            {
                if (msgElem.TryGetProperty("content", out var contentElem) && contentElem.ValueKind == JsonValueKind.String)
                {
                    chunk = contentElem.GetString();
                    return true;
                }
            }
            return true;
        }
        catch
        {
            chunk = line;
            return true;
        }
    }
}
