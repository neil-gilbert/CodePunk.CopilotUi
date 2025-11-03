using CodePunk.CopilotDesktop.Infrastructure;
using FluentAssertions;
using Xunit;

namespace CopilotDesktop.Tests;

public class CopilotOutputParserTests
{
    [Fact(DisplayName = "Given text line When parsed Then chunk extracted with newline")]
    public void Given_TextLine_When_Parsed_Then_ChunkWithNewline()
    {
        var ok = CopilotOutputParser.TryParse("Hello, world!", out var chunk);
        ok.Should().BeTrue();
        chunk.Should().Be("Hello, world!\n");
    }

    [Fact(DisplayName = "Given empty line When parsed Then returns false")]
    public void Given_EmptyLine_When_Parsed_Then_ReturnsFalse()
    {
        var ok = CopilotOutputParser.TryParse("", out var chunk);
        ok.Should().BeFalse();
        chunk.Should().BeNull();
    }

    [Fact(DisplayName = "Given whitespace line When parsed Then returns false")]
    public void Given_WhitespaceLine_When_Parsed_Then_ReturnsFalse()
    {
        var ok = CopilotOutputParser.TryParse("   ", out var chunk);
        ok.Should().BeFalse();
        chunk.Should().BeNull();
    }

    [Fact(DisplayName = "Given markdown line When parsed Then chunk preserved")]
    public void Given_MarkdownLine_When_Parsed_Then_ChunkPreserved()
    {
        var ok = CopilotOutputParser.TryParse("## This is a heading", out var chunk);
        ok.Should().BeTrue();
        chunk.Should().Be("## This is a heading\n");
    }
}

