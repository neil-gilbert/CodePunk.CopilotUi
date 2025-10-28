using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using CodePunk.CopilotDesktop.Core;

namespace CodePunk.CopilotDesktop.UI;

public class ChatViewModel : INotifyPropertyChanged
{
    private readonly ICopilotService _copilot;
    private string _inputText = string.Empty;
    private bool _isStreaming;
    private ChatMode _mode = ChatMode.Code;

    public ObservableCollection<Core.ChatMessage> Messages { get; } = new();

    public string InputText
    {
        get => _inputText;
        set
        {
            if (_inputText != value)
            {
                _inputText = value;
                OnPropertyChanged();
                SendCommand.RaiseCanExecuteChanged();
            }
        }
    }

    public bool IsStreaming
    {
        get => _isStreaming;
        private set
        {
            if (_isStreaming != value)
            {
                _isStreaming = value;
                OnPropertyChanged();
                SendCommand.RaiseCanExecuteChanged();
            }
        }
    }

    public ChatMode Mode
    {
        get => _mode;
        set
        {
            if (_mode != value)
            {
                _mode = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(IsChatMode));
            }
        }
    }

    public bool IsChatMode
    {
        get => Mode == ChatMode.Chat;
        set => Mode = value ? ChatMode.Chat : ChatMode.Code;
    }

    public AsyncRelayCommand SendCommand { get; }

    public ChatViewModel(ICopilotService copilot)
    {
        _copilot = copilot;
        SendCommand = new AsyncRelayCommand(SendAsync, CanSend);
    }

    private bool CanSend() => !IsStreaming && !string.IsNullOrWhiteSpace(InputText);

    private async Task SendAsync()
    {
        var prompt = InputText.Trim();
        if (string.IsNullOrEmpty(prompt)) return;

        InputText = string.Empty;

        var now = DateTimeOffset.Now;
        var userMsg = new Core.ChatMessage("User", prompt, now);
        Messages.Add(userMsg);

        var assistantMsg = new Core.ChatMessage("Assistant", string.Empty, now);
        Messages.Add(assistantMsg);

        IsStreaming = true;
        try
        {
            await foreach (var chunk in _copilot.StreamResponseAsync(prompt, Mode))
            {
                assistantMsg.Content += chunk;
            }
        }
        catch (Exception ex)
        {
            assistantMsg.Content += $"[error] {ex.Message}";
        }
        finally
        {
            IsStreaming = false;
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

