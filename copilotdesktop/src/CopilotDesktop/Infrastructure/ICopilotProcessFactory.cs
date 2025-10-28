namespace CodePunk.CopilotDesktop.Infrastructure;

/// <summary>
/// Factory for creating Copilot process instances.
/// </summary>
public interface ICopilotProcessFactory
{
    ICopilotProcess Create();
}

