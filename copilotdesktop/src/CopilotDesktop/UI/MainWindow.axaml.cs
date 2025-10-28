using System;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Markup.Xaml;

namespace CodePunk.CopilotDesktop.UI;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        AvaloniaXamlLoader.Load(this);
        if (this.FindControl<TextBox>("InputBox") is { } input)
        {
            input.AddHandler(KeyDownEvent, OnInputKeyDown, Avalonia.Interactivity.RoutingStrategies.Tunnel);
        }
    }

    private void OnInputKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && !e.KeyModifiers.HasFlag(KeyModifiers.Shift))
        {
            if (DataContext is MainWindowViewModel vm && vm.Chat.SendCommand.CanExecute(null))
            {
                vm.Chat.SendCommand.Execute(null);
                e.Handled = true;
            }
        }
    }
}

