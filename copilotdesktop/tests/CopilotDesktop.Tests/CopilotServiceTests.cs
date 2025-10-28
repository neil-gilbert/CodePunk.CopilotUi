using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CodePunk.CopilotDesktop.Core;
using CodePunk.CopilotDesktop.Infrastructure;
using CopilotDesktop.Tests.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CopilotDesktop.Tests;

public class CopilotServiceTests
{
    [Fact(DisplayName = "Given Chat mode When sending Then prefix is injected")]
    public async Task Given_ChatMode_When_Sending_Then_PrefixInjected()
    {
        var fakeProc = new FakeCopilotProcess();
        fakeProc.Enqueue("{\"done\":true}");
        var factory = new FakeCopilotProcessFactory();
        factory.Enqueue(fakeProc);
        var svc = new CopilotService(new NullLogger<CopilotService>(), factory);

        var results = new List<string>();
        await foreach (var line in svc.StreamResponseAsync("Hello", ChatMode.Chat))
        {
            results.Add(line);
        }

        fakeProc.Prompts.Should().HaveCount(1);
        fakeProc.Prompts[0].Should().StartWith("[system note: this is a general, non-coding conversation. Answer conversationally.]");
    }

    [Fact(DisplayName = "Given output When streaming Then yields expected lines")]
    public async Task Given_Output_When_Streaming_Then_YieldsExpected()
    {
        var fakeProc = new FakeCopilotProcess();
        fakeProc.Enqueue(
            "{\"type\":\"assistant_message\",\"delta\":\"Hello\"}",
            "{\"type\":\"assistant_message\",\"delta\":\" world\"}",
            "{\"done\":true}");
        var factory = new FakeCopilotProcessFactory();
        factory.Enqueue(fakeProc);
        var svc = new CopilotService(new NullLogger<CopilotService>(), factory);

        var collected = new List<string>();
        await foreach (var line in svc.StreamResponseAsync("Hi", ChatMode.Code))
        {
            collected.Add(line);
        }

        collected.Should().Equal(new[] { "Hello", " world" });
    }
}

