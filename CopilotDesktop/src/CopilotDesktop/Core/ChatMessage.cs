using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CodePunk.CopilotDesktop.Core;

/// <summary>
/// Represents a chat message in the conversation.
/// </summary>
public class ChatMessage : INotifyPropertyChanged
{
    private string _content;
    public string Role { get; }
    public string Content
    {
        get => _content;
        set
        {
            if (_content != value)
            {
                _content = value;
                OnPropertyChanged();
            }
        }
    }
    public DateTimeOffset Timestamp { get; }

    public ChatMessage(string role, string content, DateTimeOffset timestamp)
    {
        Role = role;
        _content = content;
        Timestamp = timestamp;
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

