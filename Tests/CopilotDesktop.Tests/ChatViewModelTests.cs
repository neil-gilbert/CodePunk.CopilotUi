using System.Linq;
using System.Threading.Tasks;
using CodePunk.CopilotDesktop.Core;
using CodePunk.CopilotDesktop.UI;
using CopilotDesktop.Tests.Utilities;
using FluentAssertions;
using Xunit;

namespace CopilotDesktop.Tests;

public class ChatViewModelTests
{
    [Fact(DisplayName = "Given markdown chunks When sending Then assistant content aggregates")]
    public async Task Given_MarkdownChunks_When_Sending_Then_Aggregates()
    {
        var fake = new FakeCopilotService();
        fake.Enqueue("Hello", " **world**");
        var vm = new ChatViewModel(fake);

        vm.InputText = "Hi";
        vm.SendCommand.Execute(null);

        for (var i = 0; i < 50 && vm.IsStreaming; i++)
            await Task.Delay(20);

        vm.Messages.Count.Should().Be(2);
        vm.Messages[0].Role.Should().Be("User");
        vm.Messages[0].Content.Should().Be("Hi");
        vm.Messages[1].Role.Should().Be("Assistant");
        vm.Messages[1].Content.Should().Be("Hello **world**");
        vm.InputText.Should().BeEmpty();
        vm.IsStreaming.Should().BeFalse();
    }

    [Fact(DisplayName = "Given mode toggle When set Then updates viewmodel mode")] 
    public void Given_ModeToggle_When_Set_Then_Updates()
    {
        var vm = new ChatViewModel(new FakeCopilotService());
        vm.Mode.Should().Be(ChatMode.Code);
        vm.IsChatMode = true;
        vm.Mode.Should().Be(ChatMode.Chat);
        vm.IsChatMode = false;
        vm.Mode.Should().Be(ChatMode.Code);
    }
}

