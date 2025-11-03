using System;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
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

    public bool HasMessages => Messages.Count > 0;

    public string InputText
    {
        get => _inputText;
        set
        {
            if (_inputText != value)
            {
                _inputText = value;
                System.Diagnostics.Debug.WriteLine($"InputText changed to: '{_inputText}'");
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
        System.Diagnostics.Debug.WriteLine($"ChatViewModel created with copilot service: {copilot?.GetType().Name ?? "NULL"}");
        _copilot = copilot ?? throw new ArgumentNullException(nameof(copilot));
        SendCommand = new AsyncRelayCommand(SendAsync, CanSend);
        Messages.CollectionChanged += OnMessagesChanged;
        System.Diagnostics.Debug.WriteLine("ChatViewModel constructor complete, SendCommand created");
    }

    private void OnMessagesChanged(object? sender, NotifyCollectionChangedEventArgs e)
        => OnPropertyChanged(nameof(HasMessages));

    private bool CanSend()
    {
        var canSend = !IsStreaming && !string.IsNullOrWhiteSpace(InputText);
        System.Diagnostics.Debug.WriteLine($"CanSend: {canSend}, IsStreaming: {IsStreaming}, InputText: '{InputText}'");
        return canSend;
    }

    private async Task SendAsync()
    {
        System.Diagnostics.Debug.WriteLine($"SendAsync called! InputText: '{InputText}'");
        var prompt = InputText.Trim();
        if (string.IsNullOrEmpty(prompt))
        {
            System.Diagnostics.Debug.WriteLine("Prompt is empty after trimming, returning early");
            return;
        }

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
            var errorMsg = ex.InnerException?.Message ?? ex.Message;
            assistantMsg.Content += $"**Error:** {errorMsg}\n\n";
            System.Diagnostics.Debug.WriteLine($"Error in SendAsync: {ex}");
        }
        finally
        {
            IsStreaming = false;
        }
    }
    
    public void ClearHistory()
    {
        Messages.Clear();
        _copilot.ClearHistory();
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
