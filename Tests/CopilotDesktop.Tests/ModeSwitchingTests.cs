using System.Collections.Generic;
using System.Threading.Tasks;
using CodePunk.CopilotDesktop.Core;
using CodePunk.CopilotDesktop.Infrastructure;
using CopilotDesktop.Tests.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CopilotDesktop.Tests;

public class ModeSwitchingTests
{
    [Fact(DisplayName = "Given mode switches When sending Then behavior updates")]
    public async Task Given_ModeSwitch_When_Sending_Then_UpdatesBehavior()
    {
        var p = new FakeCopilotProcess();
        p.Enqueue("{\"delta\":\"a\"}", "{\"done\":true}");
        p.Enqueue("{\"delta\":\"b\"}", "{\"done\":true}");
        var factory = new FakeCopilotProcessFactory();
        factory.Enqueue(p);

        var svc = new CopilotService(new NullLogger<CopilotService>(), factory);

        var res1 = new List<string>();
        await foreach (var line in svc.StreamResponseAsync("First", ChatMode.Code)) res1.Add(line);

        var res2 = new List<string>();
        await foreach (var line in svc.StreamResponseAsync("Second", ChatMode.Chat)) res2.Add(line);

        p.Prompts[0].Should().Be("First");
        p.Prompts[1].Should().StartWith("[system note:");
        res1.Should().Equal("a");
        res2.Should().Equal("b");
    }

    [Fact(DisplayName = "Given process exits When requesting again Then restarts gracefully")]
    public async Task Given_Exit_When_Requesting_Again_Then_Restarts()
    {
        var p1 = new FakeCopilotProcess(); p1.Enqueue("{\"delta\":\"first\"}", "{\"done\":true}");
        var p2 = new FakeCopilotProcess(); p2.Enqueue("{\"delta\":\"second\"}", "{\"done\":true}");
        var factory = new FakeCopilotProcessFactory();
        factory.Enqueue(p1);
        factory.Enqueue(p2);

        var svc = new CopilotService(new NullLogger<CopilotService>(), factory);

        var res1 = new List<string>();
        await foreach (var line in svc.StreamResponseAsync("One", ChatMode.Code)) res1.Add(line);

        p1.TriggerExit();

        var res2 = new List<string>();
        await foreach (var line in svc.StreamResponseAsync("Two", ChatMode.Code)) res2.Add(line);

        res1.Should().Equal("first");
        res2.Should().Equal("second");
    }
}
