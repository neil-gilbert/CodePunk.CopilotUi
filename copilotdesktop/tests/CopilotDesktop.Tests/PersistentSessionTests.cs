using System.Collections.Generic;
using System.Threading.Tasks;
using CodePunk.CopilotDesktop.Core;
using CodePunk.CopilotDesktop.Infrastructure;
using CopilotDesktop.Tests.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CopilotDesktop.Tests;

public class PersistentSessionTests
{
    [Fact(DisplayName = "Given persistent process When two prompts Then responses delimited by done events")]
    public async Task Given_PersistentProcess_When_TwoPrompts_Then_Delimited()
    {
        var fake = new FakeCopilotProcess();
        fake.Enqueue("{\"delta\":\"Hello\"}", "{\"done\":true}");
        var factory = new FakeCopilotProcessFactory();
        factory.Enqueue(fake);

        var svc = new CopilotService(new NullLogger<CopilotService>(), factory);

        var first = new List<string>();
        await foreach (var chunk in svc.StreamResponseAsync("First", ChatMode.Code))
            first.Add(chunk);
        first.Should().Equal("Hello");

        fake.Enqueue("{\"delta\":\"World\"}", "{\"done\":true}");
        var second = new List<string>();
        await foreach (var chunk in svc.StreamResponseAsync("Second", ChatMode.Code))
            second.Add(chunk);

        second.Should().Equal("World");
    }
}

