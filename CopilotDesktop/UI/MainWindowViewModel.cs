using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CodePunk.CopilotDesktop.UI;

public class MainWindowViewModel : INotifyPropertyChanged
{
    public ChatViewModel Chat { get; }

    public MainWindowViewModel(ChatViewModel chat)
    {
        Chat = chat;
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

