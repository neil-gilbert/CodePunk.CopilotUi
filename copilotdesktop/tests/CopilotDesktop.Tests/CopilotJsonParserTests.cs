using CodePunk.CopilotDesktop.Infrastructure;
using FluentAssertions;
using Xunit;

namespace CopilotDesktop.Tests;

public class CopilotJsonParserTests
{
    [Fact(DisplayName = "Given delta event When parsed Then chunk extracted")]
    public void Given_Delta_When_Parsed_Then_Chunk()
    {
        var ok = CopilotJsonParser.TryParse("{\"delta\":\"abc\"}", out var chunk, out var done, out var err);
        ok.Should().BeTrue();
        chunk.Should().Be("abc");
        done.Should().BeFalse();
        err.Should().BeNull();
    }

    [Fact(DisplayName = "Given done true When parsed Then done detected")]
    public void Given_DoneTrue_When_Parsed_Then_Done()
    {
        var ok = CopilotJsonParser.TryParse("{\"done\":true}", out var chunk, out var done, out var err);
        ok.Should().BeTrue();
        done.Should().BeTrue();
        chunk.Should().BeNull();
        err.Should().BeNull();
    }

    [Fact(DisplayName = "Given type done When parsed Then done detected")]
    public void Given_TypeDone_When_Parsed_Then_Done()
    {
        var ok = CopilotJsonParser.TryParse("{\"type\":\"done\"}", out var chunk, out var done, out var err);
        ok.Should().BeTrue();
        done.Should().BeTrue();
        chunk.Should().BeNull();
        err.Should().BeNull();
    }

    [Fact(DisplayName = "Given error field When parsed Then error surfaced")]
    public void Given_Error_When_Parsed_Then_Error()
    {
        var ok = CopilotJsonParser.TryParse("{\"error\":\"oops\"}", out var chunk, out var done, out var err);
        ok.Should().BeTrue();
        err.Should().Be("oops");
        done.Should().BeFalse();
        chunk.Should().BeNull();
    }

    [Fact(DisplayName = "Given non json When parsed Then fallback text chunk")]
    public void Given_NonJson_When_Parsed_Then_Fallback()
    {
        var ok = CopilotJsonParser.TryParse("plain text", out var chunk, out var done, out var err);
        ok.Should().BeTrue();
        chunk.Should().Be("plain text");
        done.Should().BeFalse();
        err.Should().BeNull();
    }
}

