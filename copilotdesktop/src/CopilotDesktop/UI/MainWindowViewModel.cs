using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CodePunk.CopilotDesktop.UI;

public class MainWindowViewModel : INotifyPropertyChanged
{
    public ChatViewModel Chat { get; }
    
    public string StatusText => Chat.IsStreaming ? "GitHub Copilot is thinking..." : string.Empty;

    public MainWindowViewModel(ChatViewModel chat)
    {
        Chat = chat;
        Chat.PropertyChanged += (s, e) =>
        {
            if (e.PropertyName == nameof(ChatViewModel.IsStreaming))
            {
                OnPropertyChanged(nameof(StatusText));
            }
        };
    }
    
    public void ClearHistory()
    {
        Chat.ClearHistory();
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

